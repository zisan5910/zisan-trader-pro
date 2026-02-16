import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy, where, Timestamp,
  writeBatch, doc
} from "firebase/firestore";
import { TrendingUp, Package, Users, Download, Calendar, ChevronDown, CalendarDays, Coins, BarChart3, Smartphone, Wallet, DollarSign, CreditCard, Phone } from "lucide-react";
import jsPDF from "jspdf";


const PAGE_SIZE = 10;
const CLEANUP_DAYS = 40;

const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const Reports: React.FC = () => {
  const [tab, setTab] = useState<"daily" | "monthly" | "due" | "mb">("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Daily
  const [dailySales, setDailySales] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyProfit, setDailyProfit] = useState(0);
  const [dailyDue, setDailyDue] = useState(0);
  const [dailyMBComm, setDailyMBComm] = useState(0);

  // Monthly
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [monthlyDue, setMonthlyDue] = useState(0);
  const [monthlyMBComm, setMonthlyMBComm] = useState(0);

  // MB Balance
  const [mbCurrentBalance, setMbCurrentBalance] = useState(0);

  // Lists
  const [allSalesForDay, setAllSalesForDay] = useState<any[]>([]);
  const [mbLogsForDay, setMbLogsForDay] = useState<any[]>([]);
  const [allMbLogs, setAllMbLogs] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [dueCustomers, setDueCustomers] = useState<any[]>([]);
  const [saleItemsMap, setSaleItemsMap] = useState<Record<string, any[]>>({});

  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    loadReports();
    if (!cleanupDone) { cleanupOldSales(); setCleanupDone(true); }
  }, [selectedDate, selectedMonth]);

  const cleanupOldSales = async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS);
      const cutoffTs = Timestamp.fromDate(cutoff);
      const oldSalesQ = query(collection(db, "sales"), where("created_at", "<", cutoffTs));
      const oldSnap = await getDocs(oldSalesQ);
      if (oldSnap.empty) return;
      const saleIds = oldSnap.docs.map(d => d.id);
      const batch = writeBatch(db);
      let count = 0;
      for (const saleDoc of oldSnap.docs) { batch.delete(saleDoc.ref); count++; if (count >= 400) break; }
      if (saleIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < Math.min(saleIds.length, 30); i += 10) chunks.push(saleIds.slice(i, i + 10));
        for (const chunk of chunks) {
          const itemsQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
          const itemsSnap = await getDocs(itemsQ);
          itemsSnap.forEach(d => { if (count < 450) { batch.delete(d.ref); count++; } });
        }
      }
      await batch.commit();
    } catch (e) { console.error("Cleanup error:", e); }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const selDate = new Date(selectedDate);
      const dayStart = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate());
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

      const [selYear, selMonthNum] = selectedMonth.split("-").map(Number);
      const monthStart = new Date(selYear, selMonthNum - 1, 1);
      const monthEnd = new Date(selYear, selMonthNum, 1);

      // Daily sales
      const daySalesQ = query(collection(db, "sales"), where("created_at", ">=", Timestamp.fromDate(dayStart)), where("created_at", "<", Timestamp.fromDate(dayEnd)), orderBy("created_at", "desc"));
      const daySalesSnap = await getDocs(daySalesQ);
      let dSales = 0, dProfit = 0, dDue = 0;
      const dayList: any[] = [];
      daySalesSnap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        dayList.push(data);
        dSales += (data as any).total_amount || 0;
        dProfit += (data as any).profit || 0;
        dDue += (data as any).due_amount || 0;
      });
      setDailySales(dSales); setDailyCount(dayList.length); setDailyProfit(dProfit); setDailyDue(dDue);
      setAllSalesForDay(dayList); setDisplayedCount(PAGE_SIZE);

      // Daily MB
      const mbDayQ = query(collection(db, "mobile_banking_logs"), where("created_at", ">=", Timestamp.fromDate(dayStart)), where("created_at", "<", Timestamp.fromDate(dayEnd)), orderBy("created_at", "desc"));
      const mbDaySnap = await getDocs(mbDayQ);
      const mbList: any[] = [];
      let dMBComm = 0;
      mbDaySnap.forEach((d) => { const data = { id: d.id, ...d.data() }; mbList.push(data); dMBComm += (data as any).commission || 0; });
      setMbLogsForDay(mbList);
      setDailyMBComm(dMBComm);

      // MB current balance & all logs
      const mbAllQ = query(collection(db, "mobile_banking_logs"), orderBy("created_at", "desc"));
      const mbAllSnap = await getDocs(mbAllQ);
      const allMbList: any[] = [];
      mbAllSnap.forEach((d) => allMbList.push({ id: d.id, ...d.data() }));
      setAllMbLogs(allMbList);
      if (allMbList.length > 0) {
        setMbCurrentBalance(allMbList[0].balance_after || 0);
      }

      // Monthly sales
      const monthSalesQ = query(collection(db, "sales"), where("created_at", ">=", Timestamp.fromDate(monthStart)), where("created_at", "<", Timestamp.fromDate(monthEnd)));
      const monthSnap = await getDocs(monthSalesQ);
      let mSales = 0, mProfit = 0, mDue = 0;
      monthSnap.forEach((d) => { const data = d.data(); mSales += data.total_amount || 0; mProfit += data.profit || 0; mDue += data.due_amount || 0; });
      setMonthlySales(mSales); setMonthlyCount(monthSnap.size); setMonthlyProfit(mProfit); setMonthlyDue(mDue);

      // Monthly MB commission
      const mbMonthQ = query(collection(db, "mobile_banking_logs"), where("created_at", ">=", Timestamp.fromDate(monthStart)), where("created_at", "<", Timestamp.fromDate(monthEnd)));
      const mbMonthSnap = await getDocs(mbMonthQ);
      let mMBComm = 0;
      mbMonthSnap.forEach((d) => { mMBComm += d.data().commission || 0; });
      setMonthlyMBComm(mMBComm);

      // Stock
      const prodSnap = await getDocs(collection(db, "products"));
      const items: any[] = [];
      prodSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => a.currentStock - b.currentStock);
      setStockItems(items);

      // Due
      const custSnap = await getDocs(collection(db, "customers"));
      const dues: any[] = [];
      custSnap.forEach((d) => { const c = d.data(); if (c.total_due > 0) dues.push({ id: d.id, ...c }); });
      dues.sort((a, b) => b.total_due - a.total_due);
      setDueCustomers(dues);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const displayedSales = allSalesForDay.slice(0, displayedCount);
  const hasMore = displayedCount < allSalesForDay.length;

  const dailyTotalIncome = dailyProfit + dailyMBComm;
  const monthlyTotalIncome = monthlyProfit + monthlyMBComm;

  // Bengali to English mapping for common terms
  const bnToEn = (text: string): string => {
    if (!text) return "";
    // Replace Bengali digits
    let result = text.replace(/[০-৯]/g, (d) => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]);
    // Common Bengali terms
    const map: Record<string, string> = {
      "ক্যাশ বিক্রয়": "Cash Sale", "ক্যাশ": "Cash", "নগদ": "Cash",
      "পিস": "pcs", "ব্যাগ": "bag", "কেজি": "kg", "লিটার": "ltr",
      "ফুট": "ft", "মিটার": "m", "সেট": "set", "গজ": "yd",
    };
    Object.entries(map).forEach(([bn, en]) => { result = result.split(bn).join(en); });
    return result;
  };

  const generatePDF = async (type: string) => {
    setPdfLoading(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const lineHeight = 8;
      let y = margin;

      const drawNotebookPage = () => {
        pdf.setFillColor(255, 253, 245);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setDrawColor(220, 100, 100);
        pdf.setLineWidth(0.3);
        pdf.line(margin - 3, 0, margin - 3, pageHeight);
        pdf.setDrawColor(200, 220, 240);
        pdf.setLineWidth(0.15);
        for (let ly = 20; ly < pageHeight - 10; ly += lineHeight) {
          pdf.line(margin - 5, ly, pageWidth - margin + 5, ly);
        }
        pdf.setFillColor(180, 180, 180);
        for (let x = 30; x < pageWidth - 20; x += 15) pdf.circle(x, 5, 1.5, "F");
      };

      drawNotebookPage();

      const addNewPage = () => { pdf.addPage(); drawNotebookPage(); y = margin + 5; };
      const checkPageBreak = (needed: number) => { if (y + needed > pageHeight - margin) addNewPage(); };

      const selDateObj = new Date(selectedDate);

      y = 25;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.text("Zisan Traders - Report", margin, y);
      y += lineHeight;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Date: " + selDateObj.toLocaleDateString("en-GB"), margin, y);
      y += lineHeight * 1.5;

      if (type === "daily") {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13); pdf.setTextColor(30, 58, 138);
        pdf.text("Daily Sales Report", margin, y);
        y += lineHeight * 1.2;

        pdf.setFillColor(240, 248, 255);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 40, 3, 3, "F");

        pdf.setFontSize(10); pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        pdf.text("Total Sales: Tk " + dailySales.toLocaleString(), margin + 5, y + 4);
        pdf.text("Sales Profit: Tk " + dailyProfit.toLocaleString(), margin + 5, y + 12);
        pdf.text("Total Due: Tk " + dailyDue.toLocaleString(), margin + 5, y + 20);
        pdf.text("Number of Sales: " + allSalesForDay.length, margin + 5, y + 28);
        y += 46;

        // Table header: Date | Customer | Product | Qty | Amount | Due
        checkPageBreak(15);
        pdf.setFillColor(30, 58, 138);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
        pdf.text("Time", margin + 2, y + 3);
        pdf.text("Customer", margin + 22, y + 3);
        pdf.text("Product", margin + 62, y + 3);
        pdf.text("Qty", margin + 110, y + 3);
        pdf.text("Paid", margin + 128, y + 3);
        pdf.text("Due", margin + 158, y + 3);
        y += lineHeight + 2;

        allSalesForDay.forEach((s, i) => {
          const date = s.created_at?.toDate?.();
          const timeStr = date ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
          const customerName = bnToEn(String(s.customer_name || "Cash"));
          const items = s.items || [];

          if (items.length === 0) {
            checkPageBreak(lineHeight + 2);
            const bgColor = i % 2 === 0 ? [255, 253, 245] : [245, 248, 255];
            pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(40, 40, 40);
            pdf.text(timeStr, margin + 2, y + 1);
            pdf.text(customerName.substring(0, 18), margin + 22, y + 1);
            pdf.text("-", margin + 62, y + 1);
            pdf.text("-", margin + 110, y + 1);
                pdf.text("Tk " + (s.paid_amount || 0).toLocaleString(), margin + 128, y + 1);
                pdf.text(s.due_amount > 0 ? "Tk " + s.due_amount.toLocaleString() : "-", margin + 158, y + 1);
            y += lineHeight;
          } else {
            items.forEach((item: any, j: number) => {
              checkPageBreak(lineHeight + 2);
              const bgColor = i % 2 === 0 ? [255, 253, 245] : [245, 248, 255];
              pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
              pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
              pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(40, 40, 40);

              if (j === 0) {
                pdf.text(timeStr, margin + 2, y + 1);
                pdf.text(customerName.substring(0, 18), margin + 22, y + 1);
              }
              pdf.text(bnToEn(String(item.productName || "")).substring(0, 22), margin + 62, y + 1);
              pdf.text(String(item.quantity || 0), margin + 110, y + 1);
              if (j === 0) {
                pdf.text("Tk " + (s.paid_amount || 0).toLocaleString(), margin + 128, y + 1);
                pdf.text(s.due_amount > 0 ? "Tk " + s.due_amount.toLocaleString() : "-", margin + 158, y + 1);
              }
              y += lineHeight;
            });
          }
        });

      } else if (type === "monthly") {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13); pdf.setTextColor(30, 58, 138);
        pdf.text("Monthly Sales Report", margin, y);
        y += lineHeight * 1.5;

        pdf.setFillColor(240, 245, 255);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 56, 3, 3, "F");
        pdf.setFontSize(10); pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        pdf.text("Total Sales: Tk " + monthlySales.toLocaleString(), margin + 5, y + 4);
        pdf.text("Sales Profit: Tk " + monthlyProfit.toLocaleString(), margin + 5, y + 12);
        pdf.text("Mobile Banking Commission: Tk " + monthlyMBComm.toLocaleString(), margin + 5, y + 20);
        pdf.text("Mobile Banking Balance: Tk " + mbCurrentBalance.toLocaleString(), margin + 5, y + 28);
        pdf.text("Total Due: Tk " + monthlyDue.toLocaleString(), margin + 5, y + 36);
        pdf.text("Total Income (Sales + Commission): Tk " + monthlyTotalIncome.toLocaleString(), margin + 5, y + 44);
        y += 62;

      } else if (type === "due") {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13); pdf.setTextColor(160, 50, 50);
        pdf.text("Due Report", margin, y);
        y += lineHeight * 1.2;

        const totalD = dueCustomers.reduce((s, c) => s + c.total_due, 0);
        pdf.setFontSize(11);
        pdf.setFillColor(255, 240, 240);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 14, 3, 3, "F");
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        pdf.text("Total Due: Tk " + totalD.toLocaleString(), margin + 5, y + 6);
        y += 20;

        checkPageBreak(15);
        pdf.setFillColor(160, 60, 60);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
        pdf.text("SL", margin + 3, y + 3);
        pdf.text("Customer", margin + 15, y + 3);
        pdf.text("Phone", margin + 85, y + 3);
        pdf.text("Due Amount", margin + 130, y + 3);
        y += lineHeight + 2;

        dueCustomers.forEach((c, i) => {
          checkPageBreak(lineHeight + 2);
          const bgColor = i % 2 === 0 ? [255, 253, 245] : [255, 245, 245];
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
          pdf.setFontSize(9); pdf.setTextColor(40, 40, 40);
          pdf.setFont("helvetica", "normal");
          pdf.text(String(i + 1), margin + 3, y + 1);
          pdf.text(bnToEn(String(c.name || "")).substring(0, 30), margin + 15, y + 1);
          pdf.text(String(c.phone || "N/A"), margin + 85, y + 1);
          pdf.setTextColor(180, 40, 40);
          pdf.text("Tk " + c.total_due.toLocaleString(), margin + 130, y + 1);
          y += lineHeight;
        });

      } else if (type === "mb") {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13); pdf.setTextColor(16, 185, 129);
        pdf.text("Mobile Banking Report", margin, y);
        y += lineHeight * 1.2;

        let totalCashIn = 0, totalCashOut = 0, totalRecharge = 0, totalComm = 0;
        allMbLogs.forEach((l) => {
          if (l.type === "cash_in") totalCashIn += l.amount || 0;
          else if (l.type === "cash_out") totalCashOut += l.amount || 0;
          else if (l.type === "recharge") totalRecharge += l.amount || 0;
          totalComm += l.commission || 0;
        });

        pdf.setFillColor(240, 255, 250);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 48, 3, 3, "F");
        pdf.setFontSize(10); pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "normal");
        pdf.text("Current Balance: Tk " + mbCurrentBalance.toLocaleString(), margin + 5, y + 4);
        pdf.text("Total Cash In: Tk " + totalCashIn.toLocaleString(), margin + 5, y + 12);
        pdf.text("Total Cash Out: Tk " + totalCashOut.toLocaleString(), margin + 5, y + 20);
        pdf.text("Total Recharge: Tk " + totalRecharge.toLocaleString(), margin + 5, y + 28);
        pdf.text("Total Commission: Tk " + totalComm.toLocaleString(), margin + 5, y + 36);
        y += 54;

        checkPageBreak(15);
        pdf.setFillColor(16, 185, 129);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8);
        pdf.text("Date", margin + 2, y + 3);
        pdf.text("Operator", margin + 28, y + 3);
        pdf.text("Type", margin + 62, y + 3);
        pdf.text("Amount", margin + 95, y + 3);
        pdf.text("Commission", margin + 128, y + 3);
        pdf.text("Note", margin + 160, y + 3);
        y += lineHeight + 2;

        const opNames: Record<string, string> = { bkash: "Bkash", nagad: "Nagad", rocket: "Rocket", dbbl: "Dutch Bangla", upay: "Upay", tap: "Tap" };
        const typeNames: Record<string, string> = { cash_in: "Cash In", cash_out: "Cash Out", recharge: "Recharge" };

        allMbLogs.forEach((l, i) => {
          checkPageBreak(lineHeight + 2);
          const bgColor = i % 2 === 0 ? [245, 255, 250] : [255, 253, 245];
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(40, 40, 40);
          const date = l.created_at?.toDate?.();
          pdf.text(date ? date.toLocaleDateString("en-GB") : "", margin + 2, y + 1);
          pdf.text(opNames[l.operator] || l.operator, margin + 28, y + 1);
          pdf.text(typeNames[l.type] || l.type, margin + 62, y + 1);
          pdf.text("Tk " + l.amount.toLocaleString(), margin + 95, y + 1);
          pdf.text("Tk " + (l.commission || 0).toLocaleString(), margin + 128, y + 1);
          pdf.text(String(l.notes || "").substring(0, 15), margin + 160, y + 1);
          y += lineHeight;
        });
      }

      const footerY = pageHeight - 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
      pdf.text("Generated: " + new Date().toLocaleString("en-GB"), margin, footerY);
      pdf.text("Zisan Traders - Inventory Management", pageWidth - margin - 55, footerY);

      pdf.save("zisan-traders-" + type + "-report-" + selectedDate + ".pdf");
    } catch (e) { console.error("PDF generation error:", e); }
    finally { setPdfLoading(false); }
  };

  const tabs = [
    { key: "daily" as const, label: "দৈনিক", icon: Calendar },
    { key: "monthly" as const, label: "মাসিক", icon: CalendarDays },
    { key: "due" as const, label: "বকেয়া", icon: Coins },
    { key: "mb" as const, label: "MB", icon: Smartphone },
  ];

  // Summary card component
  const SummaryCard = ({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: string; color?: string }) => (
    <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> রিপোর্ট
          </h2>
          <button onClick={() => generatePDF(tab)} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform shadow-md disabled:opacity-50">
            <Download className="w-4 h-4" /> {pdfLoading ? "তৈরি হচ্ছে..." : "PDF ডাউনলোড"}
          </button>
        </div>

        {/* Date / Month filter */}
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          {tab === "monthly" ? (
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          ) : (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          )}
        </div>

        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1 ${
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse h-20" />
              ))}
            </div>
          </div>
        ) : tab === "daily" ? (
          <div className="space-y-3">
            {/* Daily summary grid - 6 cards */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={TrendingUp} label="মোট বিক্রয়" value={`৳${toBn(dailySales.toLocaleString())}`} color="text-primary" />
              <SummaryCard icon={DollarSign} label="বিক্রয় লাভ" value={`৳${toBn(dailyProfit.toLocaleString())}`} color={dailyProfit >= 0 ? "text-success" : "text-destructive"} />
              <SummaryCard icon={Smartphone} label="MB কমিশন" value={`৳${toBn(dailyMBComm.toLocaleString())}`} color="text-secondary" />
              <SummaryCard icon={Wallet} label="MB ব্যালেন্স" value={`৳${toBn(mbCurrentBalance.toLocaleString())}`} color="text-info" />
              <SummaryCard icon={CreditCard} label="মোট বকেয়া" value={`৳${toBn(dailyDue.toLocaleString())}`} color="text-destructive" />
              <SummaryCard icon={Coins} label="মোট আয়" value={`৳${toBn(dailyTotalIncome.toLocaleString())}`} color="text-primary" />
            </div>

            {/* Sales list */}
            <div className="space-y-2">
              {displayedSales.map((s) => {
                const date = s.created_at?.toDate?.();
                return (
                  <div key={s.id} className="bg-card rounded-xl p-3 border border-border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-base font-medium text-foreground">{s.customer_name || "ক্যাশ"}</p>
                      <p className="text-sm text-muted-foreground">{date ? date.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground">৳{toBn((s.total_amount || 0).toLocaleString())}</p>
                      {s.due_amount > 0 && <p className="text-xs text-destructive font-semibold">বাকি: ৳{toBn(s.due_amount.toLocaleString())}</p>}
                      {(s.profit || 0) > 0 && <p className="text-xs text-success font-medium">লাভ: ৳{toBn(s.profit.toLocaleString())}</p>}
                    </div>
                  </div>
                );
              })}
              {allSalesForDay.length === 0 && (
                <p className="text-center text-muted-foreground py-6 text-base">এই দিনে কোনো বিক্রয় নেই</p>
              )}
              {hasMore && (
                <button onClick={() => setDisplayedCount(prev => prev + PAGE_SIZE)}
                  className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <ChevronDown className="w-4 h-4" /> আরও দেখুন
                </button>
              )}
            </div>
          </div>
        ) : tab === "monthly" ? (
          <div className="space-y-3">
            {/* Monthly summary grid - 6 cards */}
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard icon={TrendingUp} label="মোট বিক্রয়" value={`৳${toBn(monthlySales.toLocaleString())}`} color="text-primary" />
              <SummaryCard icon={DollarSign} label="বিক্রয় লাভ" value={`৳${toBn(monthlyProfit.toLocaleString())}`} color={monthlyProfit >= 0 ? "text-success" : "text-destructive"} />
              <SummaryCard icon={Smartphone} label="MB কমিশন" value={`৳${toBn(monthlyMBComm.toLocaleString())}`} color="text-secondary" />
              <SummaryCard icon={Wallet} label="MB ব্যালেন্স" value={`৳${toBn(mbCurrentBalance.toLocaleString())}`} color="text-info" />
              <SummaryCard icon={CreditCard} label="মোট বকেয়া" value={`৳${toBn(monthlyDue.toLocaleString())}`} color="text-destructive" />
              <SummaryCard icon={Coins} label="মোট আয়" value={`৳${toBn(monthlyTotalIncome.toLocaleString())}`} color="text-primary" />
            </div>
            <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
              <p className="text-sm text-muted-foreground">{toBn(monthlyCount)} টি বিক্রয়</p>
            </div>
          </div>
        ) : tab === "due" ? (
          <div className="space-y-2">
            {dueCustomers.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-base flex flex-col items-center gap-2">
                <Coins className="w-8 h-8 text-success" />
                <span>কোনো বাকি নেই</span>
              </div>
            ) : (
              <>
                <div className="bg-destructive/10 rounded-xl p-4 text-center mb-3">
                  <p className="text-base text-muted-foreground">মোট বকেয়া</p>
                  <p className="text-3xl font-bold text-destructive">৳{toBn(dueCustomers.reduce((s, c) => s + c.total_due, 0).toLocaleString())}</p>
                </div>
                {dueCustomers.map((c) => (
                  <div key={c.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-base font-semibold text-foreground">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.phone || "ফোন নেই"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center active:scale-90 transition-transform">
                          <Phone className="w-4 h-4 text-primary" />
                        </a>
                      )}
                      <span className="text-base font-bold text-destructive">৳{toBn(c.total_due.toLocaleString())}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : tab === "mb" ? (
          <div className="space-y-3">
            <div className="bg-primary rounded-xl p-5 text-center">
              <p className="text-primary-foreground/70 text-sm">বর্তমান ব্যালেন্স</p>
              <p className="text-3xl font-bold text-primary-foreground">৳{toBn(mbCurrentBalance.toLocaleString())}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                let totalCashIn = 0, totalCashOut = 0, totalRecharge = 0, totalComm = 0;
                allMbLogs.forEach((l) => {
                  if (l.type === "cash_in") totalCashIn += l.amount || 0;
                  else if (l.type === "cash_out") totalCashOut += l.amount || 0;
                  else if (l.type === "recharge") totalRecharge += l.amount || 0;
                  totalComm += l.commission || 0;
                });
                return (
                  <>
                    <SummaryCard icon={TrendingUp} label="মোট ক্যাশ ইন" value={`৳${toBn(totalCashIn.toLocaleString())}`} color="text-success" />
                    <SummaryCard icon={CreditCard} label="মোট ক্যাশ আউট" value={`৳${toBn(totalCashOut.toLocaleString())}`} color="text-destructive" />
                    <SummaryCard icon={Smartphone} label="মোট রিচার্জ" value={`৳${toBn(totalRecharge.toLocaleString())}`} color="text-info" />
                    <SummaryCard icon={Coins} label="মোট কমিশন" value={`৳${toBn(totalComm.toLocaleString())}`} color="text-primary" />
                  </>
                );
              })()}
            </div>
            <div className="space-y-2">
              {allMbLogs.slice(0, displayedCount).map((l) => {
                const date = l.created_at?.toDate?.();
                const opNames: Record<string, string> = { bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", dbbl: "ডাচ বাংলা", upay: "উপায়", tap: "ট্যাপ" };
                return (
                  <div key={l.id} className="bg-card rounded-xl p-3 border border-border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-base font-medium text-foreground">
                        {l.type === "cash_in" ? "ক্যাশ ইন" : l.type === "cash_out" ? "ক্যাশ আউট" : "রিচার্জ"} - {opNames[l.operator] || l.operator}
                      </p>
                      <p className="text-sm text-muted-foreground">{date ? date.toLocaleString("bn-BD") : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-bold ${l.type === "cash_in" ? "text-success" : "text-destructive"}`}>৳{toBn(l.amount.toLocaleString())}</p>
                      <p className="text-xs text-muted-foreground">কমিশন: ৳{toBn((l.commission || 0).toLocaleString())}</p>
                    </div>
                  </div>
                );
              })}
              {allMbLogs.length > displayedCount && (
                <button onClick={() => setDisplayedCount(prev => prev + PAGE_SIZE)}
                  className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <ChevronDown className="w-4 h-4" /> আরও দেখুন
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Reports;
