import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, CircleCheck, ClipboardCheck, LockKeyhole, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { PassportOperator } from "./PhaseFour";

type HarvestListing = {
  id: string;
  crop: string;
  farm_name: string;
  community: string;
  available_quantity: number;
  unit: string;
  harvest_window: string;
  minimum_payout: number;
};
export type PublishedOffer = {
  id: string; crop: string; farm_name: string; community: string; approved_quantity: number;
  remaining_quantity: number; unit: string; harvest_window: string; grade: string; grower_payout: number;
  packing_cost: number; platform_fee: number; route_cost: number; buyer_price: number;
};

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function PublishedHarvests({ listings, canOrder, onOrder, onPassport }: { listings: PublishedOffer[]; canOrder: boolean; onOrder: (listing: PublishedOffer) => void; onPassport: (listing: PublishedOffer) => void }) {
  if (!listings.length) return null;
  return <section className="approved-harvests">
    <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Grower-approved offers</div><h2>Available <em>harvests</em></h2><p>Each offer has been reviewed and its price split is visible.</p></div></div>
    <div className="approved-grid">{listings.map((listing) => <article className="approved-card" key={listing.id}>
      <div className="approved-card-top"><span><BadgeCheck size={15} /> Reviewed offer</span><small>{listing.id}</small></div>
      <h3>{listing.crop}</h3><p>{listing.farm_name} · {listing.community}</p>
      <div className="approved-quantity">{listing.remaining_quantity} {listing.unit} <small>available · {listing.harvest_window}</small></div>
      <div className="approved-grade">{listing.grade}</div>
      <div className="approved-price-lines"><span>Grower receives <b>{money(listing.grower_payout)}</b></span><span>Sorting & packing <b>{money(listing.packing_cost)}</b></span><span>OriginalRoot coordination <b>{money(listing.platform_fee)}</b></span><span>Route cost <b>{money(listing.route_cost)}</b></span><strong>Customer price <b>{money(listing.buyer_price)} / {listing.unit}</b></strong></div>
      <small className="offer-note">{listing.remaining_quantity} {listing.unit} unreserved · no online payment</small>
      <button className="passport-link-button" onClick={() => onPassport(listing)}><QrCode size={14} /> View batch record</button>
      <button className="button button-dark approved-order-button" disabled={!canOrder || listing.remaining_quantity < 1} onClick={() => onOrder(listing)}>{canOrder ? "Request pickup" : "Ordering unavailable here"} <ArrowRight size={14} /></button>
    </article>)}</div>
  </section>;
}

export function OrderRequestModal({ listing, onClose }: { listing: PublishedOffer; onClose: () => void }) {
  const [placed, setPlaced] = useState<{ reference: string; total: number; status: string } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(1);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { listing_id: listing.id, customer_name: String(form.get("customer_name")), customer_phone: String(form.get("customer_phone")), community: listing.community, quantity: Number(form.get("quantity")) };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create this order request.");
      setPlaced({ reference: result.reference, total: result.total, status: result.status });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the order service."); }
    setBusy(false);
  }
  async function refreshStatus() {
    if (!placed) return;
    const response = await fetch(`/api/orders/${encodeURIComponent(placed.reference)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.detail || "Could not find that order."); return; }
    setPlaced({ ...placed, status: result.status }); setStatusNote(result.latest_note || "");
  }
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><span>×</span></button><span className="eyebrow">Pickup request · {listing.community}</span><h2>{placed ? "Request received" : `Request ${listing.crop}`}</h2>{placed ? <div className="saved-state"><CircleCheck size={24} /><b>{placed.reference}</b><span>Status: {placed.status.replace(/_/g, " ")}. Estimated total: {money(placed.total)}. Payment was not collected.</span>{statusNote && <span>{statusNote}</span>}<button className="button button-dark" onClick={refreshStatus}>Refresh status</button><button className="text-button" onClick={onClose}>Close</button></div> : <><p>Enter a name and mobile number so the local pilot operator can confirm pickup details. The request is not confirmed until its status changes.</p><form className="listing-form" onSubmit={submit}><label>Your name<input name="customer_name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Mobile number<input name="customer_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10 digit Indian mobile number" autoComplete="tel-national" /></label><label>Quantity<select name="quantity" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>{Array.from({ length: Math.min(listing.remaining_quantity, 10) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {listing.unit}</option>)}</select></label><div className="operator-price-rule">Pickup community: {listing.community}. Estimated total is {money(listing.buyer_price * quantity)}; pickup timing and point will be confirmed by the operator.</div>{error && <div className="operator-error" role="alert">{error}</div>}<button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Sending request…" : "Request harvest"}</span><b>{money(listing.buyer_price * quantity)}</b></button><div className="form-note"><ShieldCheck size={15} /> No payment is collected. Your phone number is stored only by the connected local API.</div></form></>}{error && placed && <div className="operator-error" role="alert">{error}</div>}</section></div>;
}

export function OrderTrackingModal({ onClose }: { onClose: () => void }) {
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<{ status: string; crop: string; quantity: number; unit: string; total: number; latest_note: string } | null>(null);
  const [error, setError] = useState("");
  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(reference.trim())}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not find that order.");
      setResult(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach the local order service."); }
  }
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Close"><span>×</span></button><span className="eyebrow">Pickup status</span><h2>Track an order</h2><p>Enter the reference shown when you requested a harvest. Customer contact details are never shown here.</p><form className="listing-form" onSubmit={track}><label>Order reference<input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} required placeholder="VAV-0123456789ABCDEF" autoComplete="off" /></label><button className="checkout-button" type="submit"><span>Check status</span><b><ArrowRight size={15} /></b></button></form>{error && <div className="operator-error" role="alert">{error}</div>}{result && <div className="order-track-result"><b>{result.crop} · {result.quantity} {result.unit}</b><span>Status: {result.status.replace(/_/g, " ")}</span><strong>Estimated total {money(result.total)}</strong>{result.latest_note && <small>{result.latest_note}</small>}</div>}</section></div>;
}

type PickupOrder = { reference: string; crop: string; farm_name: string; customer_name: string; customer_phone: string; community: string; quantity: number; unit: string; total: number; status: string; created_at: string; events: { to_status: string; note: string }[] };

function OperatorOrderQueue({ authKey }: { authKey: string }) {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/operator/orders", { headers: { Authorization: `Bearer ${authKey}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load pickup orders.");
      setOrders(result.orders || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load pickup orders."); }
    setBusy(false);
  }
  async function move(order: PickupOrder, status: string) {
    const note = window.prompt(status === "ready_for_pickup" ? "Enter the pickup point and time to share with the customer:" : "Add a short customer-facing status note:");
    if (!note || note.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/operator/orders/${encodeURIComponent(order.reference)}/status`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authKey}` }, body: JSON.stringify({ status, note }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not update the order.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the order."); setBusy(false); }
  }
  useEffect(() => { void refresh(); }, [authKey]);
  return <section className="operator-order-queue"><div className="operator-queue-heading"><div><span className="eyebrow">Pickup management</span><h2>Customer orders <small>{orders.filter((order) => order.status !== "completed" && order.status !== "cancelled").length}</small></h2></div><span className="status-pill status-moving">Payments disabled</span></div>{error && <div className="operator-error" role="alert">{error}</div>}{orders.length === 0 ? <div className="empty-search operator-empty"><span>🧺</span><b>No pickup requests yet</b><small>{busy ? "Loading order queue…" : "Requests from approved harvests will appear here."}</small></div> : <div className="operator-listings">{orders.map((order) => <article className="panel operator-listing" key={order.reference}><div className="operator-listing-head"><div><span className="eyebrow">{order.reference} · {order.community}</span><h3>{order.crop} · {order.quantity} {order.unit}</h3><p>{order.customer_name} · {order.customer_phone}</p></div><span className={`status-pill ${order.status === "completed" ? "status-paid" : "status-review"}`}>{order.status.replace(/_/g, " ")}</span></div><div className="operator-request-grid"><span>Estimated total <b>{money(order.total)}</b></span><span>Farm / collective <b>{order.farm_name}</b></span><span>Requested <b>{new Date(order.created_at).toLocaleString("en-IN")}</b></span></div>{order.events.map((event, index) => <p className="order-event" key={index}>{event.to_status.replace(/_/g, " ")} · {event.note}</p>)}<div className="order-actions">{order.status === "requested" && <><button onClick={() => move(order, "accepted")} disabled={busy}>Accept request</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel</button></>}{order.status === "accepted" && <><button onClick={() => move(order, "ready_for_pickup")} disabled={busy}>Set pickup details</button><button className="decline" onClick={() => move(order, "cancelled")} disabled={busy}>Cancel</button></>}{order.status === "ready_for_pickup" && <button onClick={() => move(order, "completed")} disabled={busy}>Mark completed</button>}</div></article>)}</div>}</section>;
}

export function OperatorSpace({ onShop }: { onShop: () => void }) {
  const [key, setKey] = useState("");
  const [pending, setPending] = useState<HarvestListing[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  async function loadQueue(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/harvest-listings?scope=review", { headers: { Authorization: `Bearer ${key}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load the review queue.");
      setPending(result.listings || []); setConnected(true);
    } catch (caught) { setConnected(false); setError(caught instanceof Error ? caught.message : "Could not connect to the operator service."); }
    setBusy(false);
  }

  async function decide(listing: HarvestListing, decision: "approve" | "reject", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = decision === "approve" ? {
      decision,
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
      const response = await fetch(`/api/operator/harvest-listings/${encodeURIComponent(listing.id)}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not save the review decision.");
      setPending((items) => items.filter((item) => item.id !== listing.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the review decision."); }
    setBusy(false);
  }

  return <main className="grower-page operator-page"><div className="grower-top"><div className="wrap operator-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> OriginalRoot operations</span><h1>Review the offer.<br /><em>Protect the terms.</em></h1><p>Check each grower submission with them. Approve a batch only after quantity, grade, payout floor, and the full customer price are agreed.</p><button className="text-button" onClick={onShop}>Back to the harvest board <ArrowRight size={15} /></button></div><div className="operator-callout"><ShieldCheck size={20} /><span><b>Every offer starts pending</b><small>Nothing is shown to customers until an operator confirms the offer and its price split.</small></span></div></div></div>
    <div className="wrap operator-dashboard"><section className="panel operator-auth"><div className="operator-auth-copy"><span className="operator-lock"><LockKeyhole size={18} /></span><span><b>Operator access</b><small>Use the key configured on the local API server. It stays in this page's memory only.</small></span></div><form onSubmit={loadQueue}><input aria-label="Operator key" type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Operator key" autoComplete="current-password" /><button className="button button-dark" type="submit" disabled={busy || !key}>{busy ? "Connecting…" : "Open review queue"}</button><button className="icon-button" type="button" aria-label="Refresh queue" onClick={() => loadQueue()} disabled={busy || !connected}><RefreshCw size={16} /></button></form></section>
      {error && <div className="operator-error" role="alert">{error}</div>}
      {connected && <><div className="operator-queue-heading"><div><span className="eyebrow">Offer control</span><h2>Pending harvests <small>{pending.length}</small></h2></div><span className="status-pill status-review"><ClipboardCheck size={12} /> Review before publishing</span></div>
        {pending.length === 0 ? <div className="empty-search operator-empty"><span>🌱</span><b>No offers are waiting</b><small>New grower submissions will appear here for review.</small></div> : <div className="operator-listings">{pending.map((listing) => <article className="panel operator-listing" key={listing.id}><div className="operator-listing-head"><div><span className="eyebrow">{listing.id} · {listing.community}</span><h3>{listing.crop}</h3><p>{listing.farm_name} · ready {listing.harvest_window.toLowerCase()}</p></div><span className="status-pill status-review">Pending review</span></div><div className="operator-request-grid"><span>Offered quantity <b>{listing.available_quantity} {listing.unit}</b></span><span>Grower's minimum <b>{money(listing.minimum_payout)} / {listing.unit}</b></span></div><form className="operator-approve-form" onSubmit={(event) => decide(listing, "approve", event)}><div className="operator-input-grid"><label>Approved quantity<input name="approved_quantity" type="number" min="1" max={listing.available_quantity} defaultValue={listing.available_quantity} required /></label><label>Verified grade<select name="grade" defaultValue="Grade A"><option>Grade A</option><option>Grade B</option><option>Mixed</option></select></label><label>Grower payout / unit<input name="grower_payout" type="number" min={listing.minimum_payout} defaultValue={listing.minimum_payout} required /></label><label>Packing / unit<input name="packing_cost" type="number" min="0" defaultValue="4" required /></label><label>Coordination / unit<input name="platform_fee" type="number" min="0" defaultValue="5" required /></label><label>Route / unit<input name="route_cost" type="number" min="0" defaultValue="8" required /></label></div><label className="operator-note">Review note<input name="note" maxLength={240} defaultValue="Terms confirmed with grower" /></label><p className="operator-price-rule">Customer price is calculated as grower payout + packing + coordination + route. The API rejects any payout below the grower's stated minimum.</p><button className="checkout-button" type="submit" disabled={busy}><span>Approve and publish offer</span><b>Publish <ArrowRight size={15} /></b></button></form><form className="operator-reject-form" onSubmit={(event) => decide(listing, "reject", event)}><label>Decline reason<input name="note" minLength={3} maxLength={240} placeholder="Explain what needs to change" required /></label><button type="submit" disabled={busy}>Decline offer</button></form></article>)}</div>}</>}
      {connected && <OperatorOrderQueue authKey={key} />}
      {connected && <PassportOperator authKey={key} />}
      <div className="operator-release-note"><CircleCheck size={16} /><span><b>Phase 4 boundary</b><small>Passport checkpoints are append-only operator records. They improve traceability but do not independently verify the farm, crop, or evidence. No payment or delivery service is connected.</small></span></div>
    </div>
  </main>;
}

