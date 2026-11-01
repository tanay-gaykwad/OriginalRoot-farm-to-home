import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Clipboard, QrCode, ShieldCheck, X } from "lucide-react";
import type { PublishedOffer } from "./PhaseTwo";

type PassportEvent = { event_type: string; location: string; detail: string; recorded_by: string; created_at: string };
type PassportRecord = { passport: PublishedOffer & { reviewed_at: string }; events: PassportEvent[]; record_note: string };
type OperatorBatch = { id: string; crop: string; farm_name: string; community: string; approved_quantity: number; unit: string; grade: string; event_count: number };
const eventNames: Record<string, string> = { harvested: "Harvest recorded", weighed: "Weight recorded", graded: "Grade recorded", packed: "Packing recorded", handed_off: "Handoff recorded" };

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function BatchPassportModal({ listing, onClose }: { listing: PublishedOffer; onClose: () => void }) {
  const [record, setRecord] = useState<PassportRecord | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/harvest-listings/${encodeURIComponent(listing.id)}/passport`)
      .then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Batch record unavailable."); return data as PassportRecord; })
      .then((data) => { if (active) setRecord(data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load the batch record."); });
    return () => { active = false; };
  }, [listing.id]);

  async function copyLink() {
    const url = new URL(window.location.href);
    url.search = `?passport=${encodeURIComponent(listing.id)}`;
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true); }
    catch { setError("This browser could not copy the link. Copy the page address and add ?passport=" + listing.id); }
  }

  const batch = record?.passport;
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="passport-modal phase-four-passport" aria-labelledby="passport-title">
    <button className="modal-close icon-button" onClick={onClose} aria-label="Close batch passport"><X size={19} /></button>
    <div className="passport-cover"><span className="passport-kicker"><QrCode size={15} /> OriginalRoot BATCH RECORD</span><span className="passport-emoji">🌾</span><span className="passport-batch">{listing.id}</span></div>
    <div className="passport-content">
      <div className="passport-title-row"><div><span className="eyebrow">Traceable harvest record</span><h2 id="passport-title">{batch?.crop || listing.crop}</h2><p>{batch?.farm_name || listing.farm_name} · {batch?.community || listing.community}</p></div><span className="grade-pill">{batch?.grade || listing.grade}</span></div>
      {error && <div className="operator-error" role="alert">{error}</div>}
      {!batch && !error && <div className="passport-loading">Loading the batch record…</div>}
      {batch && <>
        <div className="passport-batch-facts"><span>Approved quantity<b>{batch.approved_quantity} {batch.unit}</b></span><span>Harvest window<b>{batch.harvest_window}</b></span><span>Operator review<b>{new Date(batch.reviewed_at).toLocaleString("en-IN")}</b></span></div>
        <div className="passport-price-lines"><b>Price per {batch.unit}</b><span>Grower payout <strong>{money(batch.grower_payout)}</strong></span><span>Sorting & packing <strong>{money(batch.packing_cost)}</strong></span><span>Coordination <strong>{money(batch.platform_fee)}</strong></span><span>Route cost <strong>{money(batch.route_cost)}</strong></span><span className="passport-price-total">Customer price <strong>{money(batch.buyer_price)}</strong></span></div>
        <div className="passport-events"><h3>Recorded checkpoints <small>{record?.events.length || 0}</small></h3>{record?.events.length ? record.events.map((item, index) => <article className="passport-event" key={`${item.created_at}-${index}`}><span className="passport-event-dot" /><div><b>{eventNames[item.event_type] || item.event_type}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}{item.location ? ` · ${item.location}` : ""}</small><p>{item.detail}</p><small>Entered by {item.recorded_by}</small></div></article>) : <p className="passport-empty">No handling checkpoints have been added to this batch yet.</p>}</div>
        <div className="passport-record-note"><ShieldCheck size={16} /><span>{record?.record_note}</span></div>
        <button type="button" className="passport-copy-link" onClick={copyLink}><Clipboard size={15} /> {copied ? "Link copied" : "Copy batch record link"} <ArrowRight size={14} /></button>
      </>}
    </div>
  </section></div>;
}

export function PassportOperator() {
  const [batches, setBatches] = useState<OperatorBatch[]>([]);
  const [selected, setSelected] = useState("");
  const [events, setEvents] = useState<PassportEvent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshBatches() {
    const response = await fetch("/api/operator/passports");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Could not load published batches.");
    const next = (result.listings || []) as OperatorBatch[];
    setBatches(next);
    setSelected((current) => next.some((item) => item.id === current) ? current : next[0]?.id || "");
  }

  async function refreshEvents(id: string) {
    if (!id) { setEvents([]); return; }
    const response = await fetch(`/api/harvest-listings/${encodeURIComponent(id)}/passport`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Could not load checkpoint history.");
    setEvents(result.events || []);
  }

  useEffect(() => { refreshBatches().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load published batches.")); }, []);
  useEffect(() => { refreshEvents(selected).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load checkpoint history.")); }, [selected]);

  async function recordCheckpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/operator/harvest-listings/${encodeURIComponent(selected)}/passport-events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: String(form.get("event_type")), location: String(form.get("location") || ""), detail: String(form.get("detail") || "") }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not save checkpoint.");
      formElement.reset();
      await refreshEvents(selected);
      await refreshBatches();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save checkpoint."); }
    setBusy(false);
  }

  const batch = batches.find((item) => item.id === selected);
  return <section className="passport-operator panel"><div className="operator-queue-heading"><div><span className="eyebrow">Phase 4 · Batch transparency</span><h2>Farm Passport records <small>{batches.length}</small></h2></div><span className="status-pill status-moving">Append-only checkpoints</span></div>
    <p className="passport-operator-intro">Record a handling checkpoint with the people on the ground. Entries show who recorded them and when; the platform does not independently verify the claim.</p>
    {error && <div className="operator-error" role="alert">{error}</div>}
    {!batches.length ? <div className="passport-empty">Published harvests will appear here after an offer is approved.</div> : <>
      <label className="passport-batch-select">Published batch<select value={selected} onChange={(event) => setSelected(event.target.value)}>{batches.map((item) => <option key={item.id} value={item.id}>{item.crop} · {item.farm_name} · {item.id}</option>)}</select></label>
      {batch && <div className="operator-request-grid"><span>Farm / collective<b>{batch.farm_name}</b></span><span>Batch quantity<b>{batch.approved_quantity} {batch.unit}</b></span><span>Grade<b>{batch.grade}</b></span><span>Recorded checkpoints<b>{batch.event_count}</b></span></div>}
      <form className="passport-event-form" onSubmit={recordCheckpoint}><label>Checkpoint<select name="event_type" defaultValue="harvested"><option value="harvested">Harvested</option><option value="weighed">Weighed</option><option value="graded">Graded</option><option value="packed">Packed</option><option value="handed_off">Handed to route / pickup</option></select></label><label>Place or station (optional)<input name="location" maxLength={100} placeholder="e.g. Grower collection point" /></label><label>What was observed?<textarea name="detail" required minLength={3} maxLength={240} placeholder="Record a plain, specific note shared with the grower" /></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? "Saving record…" : "Add checkpoint"}</button></form>
      <div className="passport-operator-history">{events.map((item, index) => <article className="passport-event" key={`${item.created_at}-${index}`}><span className="passport-event-dot" /><div><b>{eventNames[item.event_type] || item.event_type}</b><small>{new Date(item.created_at).toLocaleString("en-IN")}{item.location ? ` · ${item.location}` : ""}</small><p>{item.detail}</p></div></article>)}</div>
    </>}
  </section>;
}

