import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LifeBuoy, MessageCircleWarning, ShieldCheck } from "lucide-react";

type SupportEvent = { from_status: string | null; to_status: string; note: string; actor: string; created_at: string };
type Ticket = { id: string; requester_type: "customer" | "grower"; grower_id?: string; order_reference?: string; listing_id?: string | null; linked_crop?: string | null; order_crop?: string | null; customer_name?: string | null; customer_phone?: string | null; farm_name?: string | null; category: string; subject: string; message: string; requested_resolution: string; status: string; resolution_note: string; created_at: string; updated_at: string; events: SupportEvent[] };
type OfferLink = { id: string; crop: string };

const moneylessStatus = (status: string) => status.replace(/_/g, " ");
const formatTime = (value: string) => new Date(value).toLocaleString("en-IN");

function TicketTimeline({ events }: { events: SupportEvent[] }) {
  if (!events.length) return null;
  return <div className="support-timeline">{events.map((event, index) => <article key={`${event.created_at}-${index}`}><b>{moneylessStatus(event.to_status)}</b><small>{event.actor} · {formatTime(event.created_at)}</small><p>{event.note}</p></article>)}</div>;
}

export function CustomerSupportRequest({ orderReference }: { orderReference: string }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/support/customer-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_reference: orderReference, customer_phone: String(form.get("customer_phone")), category: String(form.get("category")), subject: String(form.get("subject")), message: String(form.get("message")), requested_resolution: String(form.get("requested_resolution")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not submit the support request.");
      setTicketId(result.ticket_id); setNotice(result.message); formElement.reset();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not reach OriginalRoot support."); }
    setBusy(false);
  }

  async function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice(""); setTicket(null);
    try {
      const response = await fetch("/api/support/customer-ticket-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket_id: String(form.get("ticket_id")), customer_phone: String(form.get("customer_phone")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not find that support request.");
      setTicket({ ...result.ticket, events: result.events || [] }); setTicketId(result.ticket.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not look up the support request."); }
    setBusy(false);
  }

  return <section className="support-card customer-support-card">
    <div className="support-heading"><span><MessageCircleWarning size={16} /><b>Need help with this order?</b></span><small>Order {orderReference}</small></div>
    {error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice} <b>{ticketId}</b></div>}
    {ticket && <div className="support-ticket-result"><div><b>{ticket.subject}</b><span className={`status-pill ${ticket.status === "resolved" || ticket.status === "closed" ? "status-paid" : "status-review"}`}>{moneylessStatus(ticket.status)}</span></div><p>{ticket.message}</p>{ticket.resolution_note && <p className="support-resolution"><b>Resolution:</b> {ticket.resolution_note}</p>}<TicketTimeline events={ticket.events} /></div>}
    <details className="support-details"><summary>Report an issue or track a support request</summary>
      <form className="listing-form support-form" onSubmit={submit}><label>Mobile number used for this order<input name="customer_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" /></label><div className="form-two"><label>Issue type<select name="category" defaultValue="quality"><option value="quality">Produce quality</option><option value="missing_or_wrong">Missing or incorrect items</option><option value="delivery">Delivery or pickup</option><option value="damaged">Damaged produce</option><option value="other">Other</option></select></label><label>Preferred outcome<select name="requested_resolution" defaultValue="replacement_review"><option value="replacement_review">Review for replacement</option><option value="refund_review">Review for refund</option><option value="contact_me">Contact me</option></select></label></div><label>Short summary<input name="subject" required minLength={4} maxLength={120} /></label><label>What happened?<textarea name="message" required minLength={12} maxLength={1500} rows={3} /></label><p className="support-boundary">The request will be reviewed by an operator. A refund or replacement is not automatic; this local version does not collect or return payments.</p><button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Sending…" : "Submit support request"}</span><b><ArrowRight size={14} /></b></button></form>
      <form className="support-track-form" onSubmit={track}><b>Already have a support ID?</b><div className="form-two"><label>Support ticket ID<input name="ticket_id" required placeholder="SUP-0123456789ABCDEF" /></label><label>Order mobile number<input name="customer_phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} /></label></div><button className="subtle-button" type="submit" disabled={busy}>Check support status</button></form>
    </details>
  </section>;
}

export function GrowerSupport({ offers }: { offers: OfferLink[] }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch("/api/grower/support-tickets");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Could not load your support history.");
    setTickets(result.tickets || []);
  }
  useEffect(() => { refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load support history.")); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/grower/support-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: String(form.get("category")), listing_id: String(form.get("listing_id") || ""), subject: String(form.get("subject")), message: String(form.get("message")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not submit your grievance.");
      formElement.reset(); setNotice(`${result.message} Ticket: ${result.ticket_id}`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit your grievance."); }
    setBusy(false);
  }
  return <section className="panel support-panel"><div className="panel-heading"><div><h3><LifeBuoy size={16} /> Farmer support and grievances</h3><p>Raise a concern against your account or a specific harvest offer. Updates stay attached to your grower account.</p></div></div>{error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice}</div>}<form className="listing-form support-form" onSubmit={submit}><div className="form-two"><label>Concern<select name="category" defaultValue="offer_review"><option value="offer_review">Offer review or pricing</option><option value="quality">Quality or grading</option><option value="payout_question">Payout question</option><option value="other">Other</option></select></label><label>Related harvest offer<select name="listing_id" defaultValue=""><option value="">General concern</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.crop} · {offer.id}</option>)}</select></label></div><label>Short summary<input name="subject" required minLength={4} maxLength={120} /></label><label>Explain your concern<textarea name="message" required minLength={12} maxLength={1500} rows={3} /></label><button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Submitting…" : "Send to OriginalRoot support"}</span><b><ArrowRight size={14} /></b></button></form><div className="support-ticket-list">{tickets.map((ticket) => <article key={ticket.id}><header><span><b>{ticket.subject}</b><small>{ticket.id} · {ticket.linked_crop || "General concern"} · {formatTime(ticket.created_at)}</small></span><span className="status-pill status-review">{moneylessStatus(ticket.status)}</span></header><p>{ticket.message}</p><TicketTimeline events={ticket.events} /></article>)}{tickets.length === 0 && <p className="support-empty">Your support requests will appear here.</p>}</div><p className="support-boundary">Support can investigate and record a resolution. Payments are not processed here, and no payout is issued through this request form.</p></section>;
}

const nextStatuses: Record<string, string[]> = { open: ["investigating", "awaiting_customer", "resolved", "closed"], investigating: ["awaiting_customer", "resolved", "closed"], awaiting_customer: ["investigating", "resolved", "closed"], resolved: ["investigating", "closed"], closed: ["investigating"] };

export function SupportOperations() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch("/api/operator/support-tickets");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Could not load support requests.");
    setTickets(result.tickets || []);
  }
  useEffect(() => { refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load support requests.")); }, []);
  async function update(event: FormEvent<HTMLFormElement>, ticket: Ticket) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const status = String(form.get("status"));
      const response = await fetch(`/api/operator/support-tickets/${encodeURIComponent(ticket.id)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note: String(form.get("note")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not update this support request.");
      setNotice(`Updated ${ticket.id}.`); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update this support request."); }
    setBusy(false);
  }
  return <section className="panel support-operations"><div className="operator-queue-heading"><div><span className="eyebrow">Phase 8 · Customer and farmer care</span><h2>Support queue <small>{tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length} open</small></h2></div><span className="status-pill status-moving"><LifeBuoy size={12} /> Linked to orders and harvests</span></div>{error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice}</div>}{tickets.length === 0 ? <p className="support-empty">No customer complaints or farmer grievances have been submitted.</p> : <div className="support-ticket-list">{tickets.map((ticket) => <article key={ticket.id}><header><span><b>{ticket.subject}</b><small>{ticket.id} · {ticket.requester_type === "customer" ? `${ticket.customer_name} · ${ticket.customer_phone} · order ${ticket.order_reference}` : `${ticket.farm_name} · grower grievance`} · {formatTime(ticket.created_at)}</small></span><span className="status-pill status-review">{moneylessStatus(ticket.status)}</span></header><div className="support-meta"><span>Issue <b>{moneylessStatus(ticket.category)}</b></span><span>Related batch <b>{ticket.listing_id || "Not linked"}{ticket.order_crop ? ` · ${ticket.order_crop}` : ticket.linked_crop ? ` · ${ticket.linked_crop}` : ""}</b></span><span>Requested outcome <b>{moneylessStatus(ticket.requested_resolution)}</b></span></div><p className="support-message">{ticket.message}</p>{ticket.resolution_note && <p className="support-resolution"><b>Resolution recorded:</b> {ticket.resolution_note}</p>}<TicketTimeline events={ticket.events} /><form className="support-update-form" onSubmit={(event) => update(event, ticket)}><label>Set status<select name="status" defaultValue={nextStatuses[ticket.status]?.[0] || "investigating"}>{(nextStatuses[ticket.status] || []).map((status) => <option key={status} value={status}>{moneylessStatus(status)}</option>)}</select></label><label>Customer-facing update / resolution<textarea name="note" required minLength={3} maxLength={500} rows={2} placeholder="Add the next step or explain the resolution" /></label><button className="subtle-button" type="submit" disabled={busy}>Save update</button></form></article>)}</div>}<p className="support-boundary"><ShieldCheck size={14} /> Refund and replacement requests are recorded for review only. This version does not charge, refund, or send money.</p></section>;
}
