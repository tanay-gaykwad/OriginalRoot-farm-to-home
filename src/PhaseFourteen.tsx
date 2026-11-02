import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck, Leaf, LockKeyhole, LogOut, PackageCheck, ShieldCheck } from "lucide-react";

type Customer = { id: string; username: string; full_name: string; phone: string };
type CustomerOrder = { reference: string; crop: string; category: string; farm_name: string; community: string; quantity: number; unit: string; total: number; status: string; fulfillment_method: string; created_at: string; events: { to_status: string; note: string; created_at: string }[] };
const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function CustomerWorkspace({ onShop }: { onShop: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch("/api/customer/me");
    if (!response.ok) { setCustomer(null); setOrders([]); return; }
    const result = await response.json();
    setCustomer(result.customer);
    const ordersResponse = await fetch("/api/customer/orders");
    const orderResult = await ordersResponse.json().catch(() => ({}));
    if (ordersResponse.ok) setOrders(orderResult.orders || []);
  }
  useEffect(() => { void refresh().catch(() => setError("Could not reach the customer account service.")); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = register
      ? { full_name: String(form.get("full_name")), phone: String(form.get("phone")), username: String(form.get("username")), password: String(form.get("password")) }
      : { username: String(form.get("username")), password: String(form.get("password")) };
    try {
      const response = await fetch(`/api/customer/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not sign in.");
      await refresh(); setNotice(register ? "Your account is ready. It is linked to orders you place while signed in." : "You are signed in.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the account service."); }
    setBusy(false);
  }
  async function signOut() {
    setBusy(true);
    try { await fetch("/api/customer/logout", { method: "POST" }); await refresh(); setNotice("You are signed out."); }
    catch { setError("Could not sign out. Try again."); }
    setBusy(false);
  }

  return <main className="customer-workspace wrap">
    <div className="customer-heading"><span className="eyebrow"><Leaf size={14} /> CUSTOMER ACCOUNT</span><h1>Your food, <em>in view.</em></h1><p>Keep your OriginalRoot harvest requests and their progress together in one private place.</p></div>
    {!customer ? <section className="panel customer-auth-card"><div className="customer-auth-icon"><LockKeyhole size={20} /></div><h2>{register ? "Create your account" : "Welcome back"}</h2><p>{register ? "Use an account to keep future orders together. Your mobile number is not verified by SMS in this version." : "Sign in to see orders placed from this account."}</p>
      <form className="listing-form" onSubmit={submit}>{register && <><label>Your name<input name="full_name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Mobile number<input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" /></label></>}<label>Username<input name="username" required minLength={3} maxLength={32} autoComplete="username" /></label><label>Password<input name="password" type="password" required minLength={register ? 12 : 1} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label><div className="form-note"><ShieldCheck size={15} /> Passwords are stored as salted hashes; sessions use an HTTP-only cookie.</div>{error && <div className="operator-error" role="alert">{error}</div>}<button className="checkout-button" disabled={busy}><span>{busy ? "Working…" : register ? "Create account" : "Sign in"}</span><b><ArrowRight size={15} /></b></button></form><button className="text-button customer-auth-switch" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already have an account? Sign in" : "New to OriginalRoot? Create an account"}</button>
    </section> : <><section className="panel customer-profile-card"><div><span className="eyebrow">SIGNED IN AS</span><h2>{customer.full_name}</h2><p>@{customer.username} · {customer.phone}</p></div><button className="subtle-button" onClick={signOut} disabled={busy}><LogOut size={14} /> Sign out</button></section>{notice && <div className="phase-five-notice"><CircleCheck size={15} /> {notice}</div>}{error && <div className="operator-error" role="alert">{error}</div>}
      <section className="customer-orders-section"><div className="operator-queue-heading"><div><span className="eyebrow">PRIVATE ORDER HISTORY</span><h2>Your harvest requests <small>{orders.length}</small></h2></div><button className="button button-dark" onClick={onShop}>Browse harvests <ArrowRight size={14} /></button></div>{orders.length === 0 ? <div className="approved-empty"><PackageCheck size={22} /><div><b>Your account is ready for its first order.</b><small>Orders placed while signed in will appear here with status updates.</small></div></div> : <div className="customer-order-list">{orders.map((order) => <article className="panel customer-order-card" key={order.reference}><header><span><span className="eyebrow">{order.reference} · {order.community} · {order.fulfillment_method === "delivery" ? "Delivery" : "Pickup"}</span><h3>{order.crop} · {order.quantity} {order.unit}</h3><small>{order.category === "staples" ? "Staples" : "Fresh produce"} · {order.farm_name} · {new Date(order.created_at).toLocaleDateString("en-IN")}</small></span><b className="status-pill status-review">{order.status.replace(/_/g, " ")}</b></header><div className="customer-order-foot"><strong>{money(order.total)}</strong><span>{order.events.length ? order.events[order.events.length - 1].note : "Request recorded"}</span></div></article>)}</div>}<p className="form-note"><ShieldCheck size={15} /> Your account history shows orders linked to your customer session. Guest orders remain accessible through order reference and mobile-number matching.</p></section></>}
  </main>;
}
