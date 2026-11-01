import { useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, CircleCheck, ClipboardCheck, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";

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
export type PublishedOffer = HarvestListing & {
  id: string; approved_quantity: number; grade: string; grower_payout: number;
  packing_cost: number; platform_fee: number; route_cost: number; buyer_price: number;
};

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function PublishedHarvests({ listings }: { listings: PublishedOffer[] }) {
  if (!listings.length) return null;
  return <section className="approved-harvests">
    <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Grower-approved offers</div><h2>Available <em>harvests</em></h2><p>Each offer has been reviewed and its price split is visible.</p></div></div>
    <div className="approved-grid">{listings.map((listing) => <article className="approved-card" key={listing.id}>
      <div className="approved-card-top"><span><BadgeCheck size={15} /> Reviewed offer</span><small>{listing.id}</small></div>
      <h3>{listing.crop}</h3><p>{listing.farm_name} · {listing.community}</p>
      <div className="approved-quantity">{listing.approved_quantity} {listing.unit} <small>· {listing.harvest_window}</small></div>
      <div className="approved-grade">{listing.grade}</div>
      <div className="approved-price-lines"><span>Grower receives <b>{money(listing.grower_payout)}</b></span><span>Sorting & packing <b>{money(listing.packing_cost)}</b></span><span>OriginalRoot coordination <b>{money(listing.platform_fee)}</b></span><span>Route cost <b>{money(listing.route_cost)}</b></span><strong>Customer price <b>{money(listing.buyer_price)} / {listing.unit}</b></strong></div>
      <small className="offer-note">Offer visibility does not confirm checkout, payment, or delivery.</small>
    </article>)}</div>
  </section>;
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
      <div className="operator-release-note"><CircleCheck size={16} /><span><b>Phase 2 boundary</b><small>Approved offers are visible on the connected local service. This flow does not verify farms, collect payment, or arrange delivery.</small></span></div>
    </div>
  </main>;
}

