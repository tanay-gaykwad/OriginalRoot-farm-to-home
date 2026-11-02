import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, CircleCheck, ClipboardCheck, KeyRound, LockKeyhole, LogOut, QrCode, ShieldCheck } from "lucide-react";
import { PassportOperator } from "./PhaseFour";
import { OperatorGovernance } from "./PhaseSix";
import { CustomerSupportRequest, SupportOperations } from "./PhaseEight";
import { EvidenceOperations } from "./PhaseNine";

type HarvestListing = {
  id: string;
  crop: string;
  category: "fresh" | "staples" | "unclassified";
  farm_name: string;
  community: string;
  available_quantity: number;
  unit: string;
  harvest_window: string;
  minimum_payout: number;
  grower_note?: string;
};
export type PublishedOffer = {
  id: string; crop: string; category: "fresh" | "staples"; farm_name: string; community: string; approved_quantity: number;
  remaining_quantity: number; unit: string; harvest_window: string; grade: string; grower_payout: number;
  packing_cost: number; platform_fee: number; route_cost: number; buyer_price: number; grower_note?: string; image_url?: string;
};

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function PublishedHarvests({ listings, canOrder, onOrder, onPassport }: { listings: PublishedOffer[]; canOrder: boolean; onOrder: (listing: PublishedOffer) => void; onPassport: (listing: PublishedOffer) => void }) {
  const [category, setCategory] = useState<"all" | "fresh" | "staples">("all");
  const [query, setQuery] = useState("");
  const visible = listings.filter((listing) => (category === "all" || listing.category === category) && `${listing.crop} ${listing.farm_name} ${listing.community} ${listing.grade}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  if (!listings.length) return <section className="approved-harvests">
    <div className="approved-empty"><span>🌱</span><div><b>No approved harvests are available yet.</b><small>When a grower offer passes local review, its quantity, grade, price breakdown, and order request will appear here.</small></div></div>
  </section>;
  return <section className="approved-harvests">
    <div className="harvest-tools"><div className="harvest-category-filter" role="group" aria-label="Filter harvests by crop group"><button className={category === "all" ? "selected" : ""} onClick={() => setCategory("all")}>All offers</button><button className={category === "fresh" ? "selected" : ""} onClick={() => setCategory("fresh")}>Fresh produce</button><button className={category === "staples" ? "selected" : ""} onClick={() => setCategory("staples")}>Staples</button></div><label className="harvest-search"><span>Find a crop or grower</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try wheat, toor, Mysuru…" /></label></div>
    {visible.length === 0 ? <div className="approved-empty"><span>🌾</span><div><b>{query ? "No matching harvests found." : "No offers in this crop group yet."}</b><small>{query ? "Try another crop, farm, community, or grade." : "Offers appear after a grower submits one and a local operator reviews and publishes it."}</small></div></div> : <div className="approved-grid">{visible.map((listing) => <article className="approved-card" key={listing.id}>
      {listing.image_url ? <div className="approved-card-photo"><img src={listing.image_url} alt={`${listing.crop} from ${listing.farm_name}`} loading="lazy" /><span><BadgeCheck size={12} /> Batch photo reviewed</span></div> : <div className={`approved-card-art ${listing.category}`} aria-hidden="true"><span>{listing.category === "staples" ? "🌾" : "🥬"}</span><small>{listing.category === "staples" ? "GRAINS · PULSES · OILSEEDS" : "FRESH FROM A LOCAL GROWER"}</small></div>}
      <div className="approved-card-body"><div className="approved-card-top"><span><BadgeCheck size={15} /> Reviewed offer</span><small>{listing.id}</small></div>
      <span className="harvest-category-pill">{listing.category === "fresh" ? "Fresh produce" : "Staples"}</span><h3>{listing.crop}</h3><p className="approved-grower">{listing.farm_name} <span>·</span> {listing.community}</p>
      {listing.grower_note && <div className="approved-grower-note"><small>FROM THE GROWER</small><p>{listing.grower_note}</p></div>}
      <div className="approved-quantity">{listing.remaining_quantity} {listing.unit} <small>available · {listing.harvest_window}</small></div>
      <div className="approved-grade">{listing.grade}</div>
      <div className="approved-price-lines"><span>Grower receives <b>{money(listing.grower_payout)}</b></span><span>Sorting & packing <b>{money(listing.packing_cost)}</b></span><span>Local coordination <b>{money(listing.platform_fee)}</b></span><span>Route cost <b>{money(listing.route_cost)}</b></span><strong>Customer price <b>{money(listing.buyer_price)} / {listing.unit}</b></strong></div>
      <small className="offer-note">{listing.remaining_quantity} {listing.unit} unreserved · no online payment</small>
      <button className="passport-link-button" onClick={() => onPassport(listing)}><QrCode size={14} /> Open this harvest's story</button>
      <button className="button button-dark approved-order-button" disabled={!canOrder || listing.remaining_quantity < 1} onClick={() => onOrder(listing)}>{canOrder ? "Request harvest" : "Ordering unavailable here"} <ArrowRight size={14} /></button></div>
    </article>)}</div>}
  </section>;
}

export function OrderRequestModal({ listing, onClose }: { listing: PublishedOffer; onClose: () => void }) {
  const [placed, setPlaced] = useState<{ reference: string; total: number; status: string; fulfillment_method: string; delivery_code: string } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentMethod, setFulfillmentMethod] = useState("delivery");
  const [customer, setCustomer] = useState<{ full_name: string; phone: string } | null>(null);
  const [trackingPhone, setTrackingPhone] = useState("");
  useEffect(() => { fetch("/api/customer/me").then((response) => response.ok ? response.json() : null).then((result) => setCustomer(result?.customer || null)).catch(() => setCustomer(null)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { listing_id: listing.id, customer_name: customer?.full_name || String(form.get("customer_name") || ""), customer_phone: customer?.phone || String(form.get("customer_phone") || ""), community: listing.community, quantity: Number(form.get("quantity")), fulfillment_method: fulfillmentMethod, delivery_address: String(form.get("delivery_address") || "") };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create this order request.");
      setTrackingPhone(payload.customer_phone);
      setPlaced({ reference: result.reference, total: result.total, status: result.status, fulfillment_method: result.fulfillment_method, delivery_code: result.delivery_code || "" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the order service."); }
    setBusy(false);
  }
  async function refreshStatus() {
    if (!placed) return;
    const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: placed.reference, phone: trackingPhone }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.detail || "Could not find that order."); return; }
    setPlaced({ ...placed, status: result.status }); setStatusNote(result.latest_note || "");
  }
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><span>×</span></button><span className="eyebrow">{placed?.fulfillment_method === "pickup" || fulfillmentMethod === "pickup" ? "Pickup request" : "Local delivery request"} · {listing.community}</span><h2>{placed ? "Request received" : `Request ${listing.crop}`}</h2>{placed ? <div className="saved-state"><CircleCheck size={24} /><b>{placed.reference}</b><span>Status: {placed.status.replace(/_/g, " ")}. Estimated total: {money(placed.total)}. Payment was not collected.</span>{placed.delivery_code && <div className="delivery-code-card"><small>One-time handoff code</small><strong>{placed.delivery_code}</strong><span>Save this code now; it cannot be recovered from order tracking. Show it only when your produce arrives.</span></div>}{statusNote && <span>{statusNote}</span>}<button className="button button-dark" onClick={refreshStatus}>Refresh status</button><button className="text-button" onClick={onClose}>Close</button></div> : <><p>Request a local delivery or pickup. The operator will confirm availability and timing. No payment is collected here.</p><form className="listing-form" onSubmit={submit}>{customer ? <div className="form-note"><ShieldCheck size={15} /> Request will be linked to {customer.full_name}’s customer account.</div> : <><label>Your name<input name="customer_name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Mobile number<input name="customer_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10 digit Indian mobile number" autoComplete="tel-national" /></label></>}<label>Fulfilment<select value={fulfillmentMethod} onChange={(event) => setFulfillmentMethod(event.target.value)}><option value="delivery">Local delivery</option><option value="pickup">Pickup</option></select></label>{fulfillmentMethod === "delivery" && <label>Delivery address<textarea name="delivery_address" required minLength={12} maxLength={240} rows={3} autoComplete="street-address" placeholder="House or building, street, area" /></label>}<label>Quantity<select name="quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{Array.from({ length: Math.min(listing.remaining_quantity, 10) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {listing.unit}</option>)}</select></label><div className="operator-price-rule">Community: {listing.community}. Estimated total is {money(listing.buyer_price * quantity)}; fulfilment details will be confirmed by the operator.</div>{error && <div className="operator-error" role="alert">{error}</div>}<button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Sending request…" : "Request harvest"}</span><b>{money(listing.buyer_price * quantity)}</b></button><div className="form-note"><ShieldCheck size={15} /> No payment is collected. Contact details and delivery address are stored only by the connected local API.</div></form></>}{error && placed && <div className="operator-error" role="alert">{error}</div>}</section></div>;
}

export function OrderTrackingModal({ onClose }: { onClose: () => void }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{ reference: string; status: string; crop: string; category: string; quantity: number; unit: string; total: number; latest_note: string; fulfillment_method: string; events: { to_status: string; note: string; created_at: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: reference.trim(), phone }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not find that order.");
      setResult(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the local order service."); }
    setBusy(false);
  }
  async function cancelOrder() {
    if (!result || result.status !== "requested" || !window.confirm(`Cancel request ${result.reference}?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/orders/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: result.reference, phone }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not cancel this request.");
      setResult({ ...result, status: "cancelled", latest_note: data.message, events: [...result.events, { to_status: "cancelled", note: "Customer cancelled before operator acceptance", created_at: data.updated_at }] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the order service."); }
    setBusy(false);
  }
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><span>×</span></button><span className="eyebrow">Order status</span><h2>Track an order</h2><p>For a guest order, enter its reference and checkout mobile number. Sign in to My orders to see account-linked requests.</p><form className="listing-form" onSubmit={track}><label>Order reference<input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} required placeholder="VAV-0123456789ABCDEF" autoComplete="off" /></label><label>Mobile number used for this order<input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" /></label><button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Checking…" : "Check status"}</span><b><ArrowRight size={15} /></b></button></form>{error && <div className="operator-error" role="alert">{error}</div>}{result && <><div className="order-track-result"><b>{result.category === "staples" ? "Staples" : "Fresh produce"} · {result.crop} · {result.quantity} {result.unit}</b><span>{result.fulfillment_method === "delivery" ? "Local delivery" : "Pickup"} · Status: {result.status.replace(/_/g, " ")}</span><strong>Estimated total {money(result.total)}</strong>{result.events?.map((event, index) => <small key={index}>{event.to_status.replace(/_/g, " ")} · {event.note}</small>)}{result.status === "requested" && <button className="decline" onClick={cancelOrder} disabled={busy}>Cancel request before operator acceptance</button>}</div><CustomerSupportRequest orderReference={result.reference} /></>}</section></div>;
}

type PickupOrder = { reference: string; crop: string; category: string; farm_name: string; customer_name: string; customer_phone: string; community: string; delivery_address: string; fulfillment_method: "pickup" | "delivery"; quantity: number; unit: string; total: number; status: string; created_at: string; events: { to_status: string; note: string }[] };

function OperatorOrderQueue() {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/operator/orders");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load pickup orders.");
      setOrders(result.orders || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load pickup orders."); }
    setBusy(false);
  }
  async function move(order: PickupOrder, status: string) {
    const deliveryCode = status === "delivered" ? window.prompt("Enter the one-time code provided by the customer:") : "";
    if (status === "delivered" && !deliveryCode) return;
    const note = status === "ready_for_pickup" ? window.prompt("Enter the pickup point and time to share with the customer:") : status === "ready_for_delivery" ? window.prompt("Add the planned delivery window or dispatch note:") : status === "delivery_failed" ? window.prompt("Explain why the delivery could not be completed:") : status === "out_for_delivery" ? window.prompt("Add a short dispatch note:") : status === "delivered" ? "Customer handoff code verified" : window.prompt("Add a short customer-facing status note:");
    if (!note || note.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/operator/orders/${encodeURIComponent(order.reference)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note, delivery_code: deliveryCode || undefined }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not update the order.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the order."); setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="operator-order-queue"><div className="operator-queue-heading"><div><span className="eyebrow">Order fulfilment</span><h2>Customer orders <small>{orders.filter((order) => !["completed", "delivered", "cancelled"].includes(order.status)).length}</small></h2></div><div className="order-queue-tools"><button className="subtle-button" onClick={() => void refresh()} disabled={busy}>Refresh orders</button><span className="status-pill status-moving">Payments disabled</span></div></div>{error && <div className="operator-error" role="alert">{error}</div>}{orders.length === 0 ? <div className="empty-search operator-empty"><span>🧺</span><b>No customer requests yet</b><small>{busy ? "Loading order queue…" : "Requests from approved harvests will appear here."}</small></div> : <div className="operator-listings">{orders.map((order) => <article className="panel operator-listing" key={order.reference}><div className="operator-listing-head"><div><span className="eyebrow">{order.reference} · {order.community} · {order.category === "staples" ? "Staples" : "Fresh produce"} · {order.fulfillment_method === "delivery" ? "Delivery" : "Pickup"}</span><h3>{order.crop} · {order.quantity} {order.unit}</h3><p>{order.customer_name} · {order.customer_phone}</p></div><span className={`status-pill ${["completed", "delivered"].includes(order.status) ? "status-paid" : "status-review"}`}>{order.status.replace(/_/g, " ")}</span></div><div className="operator-request-grid"><span>Estimated total <b>{money(order.total)}</b></span><span>Farm / collective <b>{order.farm_name}</b></span><span>Requested <b>{new Date(order.created_at).toLocaleString("en-IN")}</b></span>{order.fulfillment_method === "delivery" && <span className="delivery-address">Delivery address <b>{order.delivery_address}</b></span>}</div>{order.events.map((event, index) => <p className="order-event" key={index}>{event.to_status.replace(/_/g, " ")} · {event.note}</p>)}<div className="order-actions">{order.status === "requested" && <><button onClick={() => move(order, "accepted")} disabled={busy}>Accept request</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel</button></>}{order.fulfillment_method === "pickup" && order.status === "accepted" && <><button onClick={() => move(order, "ready_for_pickup")} disabled={busy}>Set pickup details</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel</button></>}{order.fulfillment_method === "pickup" && order.status === "ready_for_pickup" && <button onClick={() => move(order, "completed")} disabled={busy}>Mark completed</button>}{order.fulfillment_method === "delivery" && order.status === "accepted" && <><button onClick={() => move(order, "ready_for_delivery")} disabled={busy}>Prepare delivery</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel</button></>}{order.fulfillment_method === "delivery" && order.status === "ready_for_delivery" && <button onClick={() => move(order, "out_for_delivery")} disabled={busy}>Dispatch order</button>}{order.fulfillment_method === "delivery" && order.status === "out_for_delivery" && <><button onClick={() => move(order, "delivered")} disabled={busy}>Verify handoff code</button><button className="decline" onClick={() => move(order, "delivery_failed")} disabled={busy}>Log failed delivery</button></>}{order.fulfillment_method === "delivery" && order.status === "delivery_failed" && <><button onClick={() => move(order, "out_for_delivery")} disabled={busy}>Retry delivery</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel order</button></>}</div></article>)}</div>}</section>;
}

type OperatorAccount = { id: string; username: string; full_name: string; role: "owner" | "operator" };

export function OperatorSpace({ onShop }: { onShop: () => void }) {
  const [operator, setOperator] = useState<OperatorAccount | null>(null);
  const [pending, setPending] = useState<HarvestListing[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [bootstrapConfigured, setBootstrapConfigured] = useState(false);

  async function loadQueue() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/harvest-listings?scope=review");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load the review queue.");
      setPending(result.listings || []); setConnected(true);
    } catch (caught) { setConnected(false); setError(caught instanceof Error ? caught.message : "Could not connect to the operator service."); }
    setBusy(false);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch("/api/operator/me");
        if (response.ok) {
          const result = await response.json();
          if (active) { setOperator(result.operator); await loadQueue(); }
          return;
        }
        const statusResponse = await fetch("/api/operator/setup-status");
        const status = await statusResponse.json().catch(() => ({}));
        if (active) {
          setSetupRequired(Boolean(status.setup_required));
          setBootstrapConfigured(Boolean(status.operator_access_configured));
          if (!status.operator_access_configured) setError("Set OriginalRoot_OPERATOR_TOKEN in the local .env file before first operator setup.");
        }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not connect to the local operator service."); }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = setupRequired ? {
      full_name: String(form.get("full_name") || ""),
      username: String(form.get("username") || ""),
      password: String(form.get("password") || ""),
      bootstrap_key: String(form.get("bootstrap_key") || ""),
    } : { username: String(form.get("username") || ""), password: String(form.get("password") || "") };
    try {
      const response = await fetch(setupRequired ? "/api/operator/bootstrap" : "/api/operator/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not sign in.");
      setOperator(result.operator); setSetupRequired(false); setError("");
      await loadQueue();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not sign in."); }
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    try { await fetch("/api/operator/logout", { method: "POST" }); setOperator(null); setConnected(false); setPending([]); }
    catch { setError("Could not sign out. Please retry."); }
    setBusy(false);
  }

  async function decide(listing: HarvestListing, decision: "approve" | "reject", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = decision === "approve" ? {
      decision,
      category: String(form.get("category")),
      approved_quantity: Number(form.get("approved_quantity")),
      grade: String(form.get("grade")),
      grower_payout: Number(form.get("grower_payout")),
      packing_cost: Number(form.get("packing_cost")),
      platform_fee: Number(form.get("platform_fee")),
      route_cost: Number(form.get("route_cost")),
      note: String(form.get("note") || "Terms confirmed with grower"),
    } : { decision, note: String(form.get("note") || "") };
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/operator/harvest-listings/" + encodeURIComponent(listing.id) + "/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not save the review decision.");
      setPending((items) => items.filter((item) => item.id !== listing.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the review decision."); }
    setBusy(false);
  }

  return <main className="grower-page operator-page"><div className="grower-top"><div className="wrap operator-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> OriginalRoot local operations</span><h1>Named operators.<br /><em>Clear responsibility.</em></h1><p>Each review and batch update is tied to an individual operator account. The first owner account is set up once with the local bootstrap key.</p><button className="text-button" onClick={onShop}>Back to the harvest board <ArrowRight size={15} /></button></div><div className="operator-callout"><ShieldCheck size={20} /><span><b>Accountable operations</b><small>Operator actions are attributed in the local operations history.</small></span></div></div></div>
    <div className="wrap operator-dashboard">
      {!operator ? <section className="panel operator-auth phase-six-auth"><div className="operator-auth-copy"><span className="operator-lock">{setupRequired ? <KeyRound size={18} /> : <LockKeyhole size={18} />}</span><span><b>{setupRequired ? "Set up the workspace owner" : "Operator sign in"}</b><small>{setupRequired ? "Use the local bootstrap key once to create the named owner account. The key will not be used for later reviews." : "Sign in with your personal operator username and password."}</small></span></div>
        {setupRequired && !bootstrapConfigured ? <p className="operator-price-rule">Set OriginalRoot_OPERATOR_TOKEN in the local .env file before creating the first operator account.</p> : <form onSubmit={authenticate}>{setupRequired && <><input name="full_name" aria-label="Owner name" placeholder="Owner name" required minLength={2} maxLength={80} /><input name="bootstrap_key" aria-label="Bootstrap key" type="password" placeholder="One-time bootstrap key from .env" required autoComplete="off" /></>}<input name="username" aria-label="Operator username" placeholder="Username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.-]{3,32}" autoComplete="username" /><input name="password" aria-label="Operator password" type="password" placeholder={setupRequired ? "Create a password (12+ characters)" : "Password"} required minLength={setupRequired ? 12 : 1} maxLength={128} autoComplete={setupRequired ? "new-password" : "current-password"} /><button className="button button-dark" type="submit" disabled={busy}>{busy ? "Please wait…" : setupRequired ? "Create owner account" : "Sign in"}</button></form>}
      </section> : <>
        <section className="panel operator-auth phase-six-authenticated"><div className="operator-auth-copy"><span className="operator-lock"><LockKeyhole size={18} /></span><span><b>{operator.full_name}</b><small>@{operator.username} · {operator.role} · personal operator session</small></span></div><button className="subtle-button" onClick={signOut} disabled={busy}><LogOut size={14} /> Sign out</button></section>
        {connected && <><div className="operator-queue-heading"><div><span className="eyebrow">Offer control</span><h2>Pending harvests <small>{pending.length}</small></h2></div><span className="status-pill status-review"><ClipboardCheck size={12} /> Review before publishing</span></div>
          {pending.length === 0 ? <div className="empty-search operator-empty"><span>🌱</span><b>No offers are waiting</b><small>{busy ? "Loading review queue…" : "New grower submissions will appear here for review."}</small></div> : <div className="operator-listings">{pending.map((listing) => <article className="panel operator-listing" key={listing.id}><div className="operator-listing-head"><div><span className="eyebrow">{listing.id} · {listing.community}</span><h3>{listing.crop}</h3><p>{listing.farm_name} · ready {listing.harvest_window.toLowerCase()}</p></div><span className="status-pill status-review">Pending review</span></div><div className="operator-request-grid"><span>Offered quantity <b>{listing.available_quantity} {listing.unit}</b></span><span>Grower's minimum <b>{money(listing.minimum_payout)} / {listing.unit}</b></span></div>{listing.grower_note && <div className="approved-grower-note"><small>NOTE FROM GROWER</small><p>{listing.grower_note}</p></div>}<form className="operator-approve-form" onSubmit={(event) => decide(listing, "approve", event)}><div className="operator-input-grid"><label>Approved quantity<input name="approved_quantity" type="number" min="1" max={listing.available_quantity} defaultValue={listing.available_quantity} required /></label><label>Offer category<select name="category" defaultValue={listing.category === "staples" ? "staples" : listing.category === "fresh" ? "fresh" : ""} required><option value="">Choose category</option><option value="fresh">Fresh produce</option><option value="staples">Staples</option></select></label><label>Quality class<select name="grade" defaultValue="Grade A"><option>Grade A</option><option>Grade B</option><option>Mixed</option></select></label><label>Grower payout / unit<input name="grower_payout" type="number" min={listing.minimum_payout} defaultValue={listing.minimum_payout} required /></label><label>Packing / unit<input name="packing_cost" type="number" min="0" defaultValue="4" required /></label><label>Coordination / unit<input name="platform_fee" type="number" min="0" defaultValue="5" required /></label><label>Route / unit<input name="route_cost" type="number" min="0" defaultValue="8" required /></label></div><label className="operator-note">Review note<input name="note" maxLength={240} defaultValue="Terms confirmed with grower" /></label><p className="operator-price-rule">Customer price is calculated as grower payout + packing + coordination + route. The API rejects any payout below the grower's stated minimum.</p><button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Saving…" : "Approve and publish offer"}</span><b>Publish <ArrowRight size={15} /></b></button></form><form className="operator-reject-form" onSubmit={(event) => decide(listing, "reject", event)}><label>Decline reason<input name="note" minLength={3} maxLength={240} placeholder="Explain what needs to change" required /></label><button type="submit" disabled={busy}>Decline offer</button></form></article>)}</div>}</>}
        {connected && <OperatorOrderQueue />}
        {connected && <SupportOperations />}
        {connected && <PassportOperator />}
        {connected && <EvidenceOperations />}
        {connected && <OperatorGovernance isOwner={operator.role === "owner"} />}
        <div className="operator-release-note"><CircleCheck size={16} /><span><b>Local operations boundary</b><small>Access is account-specific and activity is attributed in a local history. The records are not tamper-proof, and this service remains local-only.</small></span></div>
      </>}
      {error && <div className="operator-error" role="alert">{error}</div>}
    </div>
  </main>;
}

