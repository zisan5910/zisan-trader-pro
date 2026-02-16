import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import {
  Package, Users, AlertTriangle, TrendingUp,
  Plus, LogOut, Smartphone, ArrowRight, BarChart3, AlertCircle,
  Boxes, DollarSign, Wallet, CreditCard, Zap, Coins, Phone, UserPlus, ShoppingCart
} from "lucide-react";
import { DashboardSkeleton } from "@/components/SkeletonLoader";

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [todaySales, setTodaySales] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [mbCurrentBalance, setMbCurrentBalance] = useState(0);
  const [mbTodayCommission, setMbTodayCommission] = useState(0);
  const [todayTotalIncome, setTodayTotalIncome] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [dueCustomers, setDueCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Timestamp.fromDate(today);

      // Run all queries in parallel
      const [salesSnap, mbSnap, mbAllSnap, custSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, "sales"), where("created_at", ">=", todayTs), orderBy("created_at", "desc"))),
        getDocs(query(collection(db, "mobile_banking_logs"), where("created_at", ">=", todayTs))),
        getDocs(query(collection(db, "mobile_banking_logs"), orderBy("created_at", "desc"))),
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "products")),
      ]);

      let salesTotal = 0, profitTotal = 0;
      salesSnap.forEach((doc) => {
        const d = doc.data();
        salesTotal += d.total_amount || 0;
        profitTotal += d.profit || 0;
      });
      setTodaySales(salesTotal);
      setTodayCount(salesSnap.size);
      setTodayProfit(profitTotal);

      let mbComm = 0;
      mbSnap.forEach((doc) => { mbComm += doc.data().commission || 0; });
      setMbTodayCommission(mbComm);
      setTodayTotalIncome(profitTotal + mbComm);

      if (!mbAllSnap.empty) {
        setMbCurrentBalance(mbAllSnap.docs[0].data().balance_after || 0);
      }

      let dues = 0;
      const dueList: any[] = [];
      custSnap.forEach((doc) => {
        const d = doc.data();
        dues += d.total_due || 0;
        if (d.total_due > 0) dueList.push({ id: doc.id, ...d });
      });
      setTotalDue(dues);
      setTotalCustomers(custSnap.size);
      dueList.sort((a, b) => b.total_due - a.total_due);
      setDueCustomers(dueList);

      const lowStock: any[] = [];
      prodSnap.forEach((doc) => {
        const d = doc.data();
        if (d.currentStock <= (d.lowStockLimit || 5)) lowStock.push({ id: doc.id, ...d });
      });
      setTotalProducts(prodSnap.size);
      setLowStockItems(lowStock);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="animate-fade-in pb-4">
      {/* Top Bar */}
      <div className="bg-primary px-5 pt-6 pb-12 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-primary-foreground/20">
              <img src="/owner.jpg" alt="Owner" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">জিসান ট্রেডার্স</h1>
              <p className="text-primary-foreground/60 text-xs">মো রকিবুল হাসান সেখ</p>
            </div>
          </div>
          <button onClick={logout} className="p-2.5 rounded-full bg-primary-foreground/10 text-primary-foreground active:scale-95 transition-transform">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-8 space-y-4">
        {/* Summary Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: TrendingUp, label: "আজকের বিক্রয়", value: `৳${todaySales.toLocaleString("bn-BD")}`, color: "text-primary" },
            { icon: DollarSign, label: "আজকের লাভ", value: `৳${todayProfit.toLocaleString("bn-BD")}`, color: "text-success" },
            { icon: CreditCard, label: "মোট বকেয়া", value: `৳${totalDue.toLocaleString("bn-BD")}`, color: "text-destructive" },
            { icon: Boxes, label: "মোট পণ্য", value: totalProducts.toLocaleString("bn-BD"), color: "text-info" },
            { icon: Users, label: "মোট কাস্টমার", value: totalCustomers.toLocaleString("bn-BD"), color: "text-secondary" },
            { icon: Wallet, label: "MB ব্যালেন্স", value: `৳${mbCurrentBalance.toLocaleString("bn-BD")}`, color: "text-primary" },
            { icon: Smartphone, label: "MB কমিশন (আজ)", value: `৳${mbTodayCommission.toLocaleString("bn-BD")}`, color: "text-secondary" },
            { icon: Coins, label: "মোট আয় (আজ)", value: `৳${todayTotalIncome.toLocaleString("bn-BD")}`, color: "text-primary" },
          ].map((card, i) => (
            <div key={i} className="bg-card rounded-2xl p-4 border border-border shadow-sm text-center">
              <card.icon className={`w-6 h-6 mx-auto mb-1 ${card.color}`} />
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className={`text-lg font-bold ${card.color} mt-0.5`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: ShoppingCart, label: "নতুন বিক্রয়", path: "/sales/new", color: "text-primary", bg: "bg-primary/10" },
            { icon: Package, label: "পণ্য যোগ", path: "/products/add", color: "text-info", bg: "bg-info/10" },
            { icon: UserPlus, label: "কাস্টমার যোগ", path: "/customers/add", color: "text-secondary", bg: "bg-secondary/10" },
            { icon: Smartphone, label: "মোবাইল ব্যাংকিং", path: "/mobile-banking", color: "text-success", bg: "bg-success/10" },
          ].map((a) => (
            <button key={a.path} onClick={() => navigate(a.path)}
              className="bg-card rounded-2xl p-3 border border-border shadow-sm flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                <a.icon className={`w-5 h-5 ${a.color}`} />
              </div>
              <span className="text-[11px] text-foreground font-semibold text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-destructive/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <h3 className="text-base font-bold text-foreground">স্টক কম আছে ({lowStockItems.length})</h3>
            </div>
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <span className="text-base text-foreground font-medium">{item.product_name}</span>
                  <span className="text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                    {item.currentStock} {item.unit}
                  </span>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <button onClick={() => navigate("/reports")} className="text-sm text-primary font-semibold mt-1">
                  আরও {lowStockItems.length - 5} টি দেখুন →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Due Customers Alert */}
        {dueCustomers.length > 0 && (
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-base font-bold text-foreground">বকেয়া কাস্টমার ({dueCustomers.length})</h3>
            </div>
            <div className="space-y-2">
              {dueCustomers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-medium text-foreground">{c.name}</span>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center active:scale-90 transition-transform">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    )}
                    <span className="text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                      ৳{c.total_due.toLocaleString("bn-BD")}
                    </span>
                  </div>
                </div>
              ))}
              {dueCustomers.length > 5 && (
                <button onClick={() => navigate("/customers")} className="text-sm text-primary font-semibold mt-1">
                  সকল দেখুন →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reports Link */}
        <button onClick={() => navigate("/reports")}
          className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-base font-semibold text-foreground">রিপোর্ট ও বিশ্লেষণ</span>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
