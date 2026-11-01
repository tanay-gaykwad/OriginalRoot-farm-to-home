import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";

type Offer = { id: string; crop: string; status?: string };
type EvidenceEvent = { action: string; note: string; actor: string; actor_role: string; created_at: string };
type EvidenceRecord = {
  id: string; listing_id: string; grower_id: string; grower_username?: string; crop: string; farm_name?: string;
  community?: string; evidence_type: string; caption: string; media_type: string; byte_size: number; sha256: string;
  review_status: "pending" | "approved" | "declined"; review_note: string; submitted_at: string;
  reviewed_at: string | null; reviewed_by?: string | null; file_url: string; events: EvidenceEvent[];
};

const evidenceNames: Record<string, string> = { field: "Field or farm", harvest: "Harvest", weight: "Weighing", grade: "Grading", packing: "Packing", other: "Other batch record" };
const statusName = (status: string) => status.replace(/_/g, " ");
const formatDate = (value: string) => new Date(value).toLocaleString("en-IN");
const bytesLabel = (value: number) => `${(value / 1024).toFixed(0)} KB`;

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function EvidenceHistory({ events }: { events: EvidenceEvent[] }) {
  if (!events.length) return null;
  return <div className="evidence-history">{events.map((event, index) => <small key={`${event.created_at}-${index}`}>{statusName(event.action)} · {event.actor} · {formatDate(event.created_at)}{event.note ? ` — ${event.note}` : ""}</small>)}</div>;
}

export function GrowerEvidence({ offers }: { offers: Offer[] }) {
  const [items, setItems] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/grower/evidence").then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load your evidence.");
      if (active) setItems(result.evidence || []);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load your evidence."); });
    return () => { active = false; };
  }, [refreshKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("evidence_file");
    if (!(file instanceof File) || file.size === 0) { setError("Choose an image to upload."); return; }
    if (file.size > 2_000_000) { setError("Evidence images must be no larger than 2 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/grower/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: String(form.get("listing_id")), evidence_type: String(form.get("evidence_type")), caption: String(form.get("caption")), media_type: file.type, file_base64: await fileToBase64(file) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not submit the evidence.");
      formElement.reset(); setNotice(`${result.message} Reference: ${result.id}`); setRefreshKey((value) => value + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit the evidence."); }
    setBusy(false);
  }

  return <section className="panel evidence-panel">
    <div className="panel-heading"><div><h3><FileCheck2 size={16} /> Batch evidence</h3><p>Attach a photo to one of your harvest offers. An operator must review it before customers can see it.</p></div><span className="status-pill status-review">{items.filter((item) => item.review_status === "pending").length} awaiting review</span></div>
    {error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice}</div>}
    <form className="evidence-upload-form" onSubmit={submit}>
      <label>Harvest offer<select name="listing_id" required defaultValue=""><option value="" disabled>Select your offer</option>{offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.crop} · {offer.id}</option>)}</select></label>
      <label>What does it show?<select name="evidence_type" defaultValue="harvest"><option value="field">Field or farm</option><option value="harvest">Harvest</option><option value="weight">Weighing</option><option value="grade">Grading</option><option value="packing">Packing</option><option value="other">Other batch record</option></select></label>
      <label>Short note<input name="caption" required minLength={4} maxLength={180} placeholder="e.g. Weighing at the collection point" /></label>
      <label>Image (JPEG, PNG, WebP; max 2 MB)<input name="evidence_file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <button className="checkout-button" type="submit" disabled={busy || offers.length === 0}><span>{busy ? "Uploading privately…" : "Submit for review"}</span><b><UploadCloud size={15} /></b></button>
      {offers.length === 0 && <p className="evidence-note">Submit a harvest offer first. Evidence accepts image files only; remove location metadata and do not include identity documents, customer details, or unrelated private material.</p>}
    </form>
    <div className="evidence-list">{items.map((item) => <article key={item.id}><div className="evidence-list-heading"><span><b>{evidenceNames[item.evidence_type] || item.evidence_type} · {item.crop}</b><small>{item.id} · {item.listing_id} · {bytesLabel(item.byte_size)} · submitted {formatDate(item.submitted_at)}</small></span><span className={`status-pill ${item.review_status === "approved" ? "status-paid" : "status-review"}`}>{statusName(item.review_status)}</span></div><p>{item.caption}</p>{item.review_note && <p className="evidence-review-note"><b>Operator note:</b> {item.review_note}</p>}<a href={item.file_url} target="_blank" rel="noreferrer">View your submitted image</a><EvidenceHistory events={item.events} /></article>)}{items.length === 0 && <p className="support-empty">Your evidence submissions and review notes will appear here.</p>}</div>
    <p className="evidence-note"><ShieldCheck size={14} /> Evidence stays private until approved. Remove location metadata before upload. Review records who checked it; it does not independently certify the farm or prove every claim.</p>
  </section>;
}

export function EvidenceOperations() {
  const [items, setItems] = useState<EvidenceRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/operator/evidence").then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load evidence for review.");
      if (active) setItems(result.evidence || []);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load evidence for review."); });
    return () => { active = false; };
  }, [refreshKey]);

  async function decide(event: FormEvent<HTMLFormElement>, item: EvidenceRecord) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/operator/evidence/${encodeURIComponent(item.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: String(form.get("decision")), note: String(form.get("note")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not save the evidence review.");
      setNotice(`${item.id} marked ${statusName(result.review_status)}.`); setRefreshKey((value) => value + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the evidence review."); }
    setBusy(false);
  }

  return <section className="panel evidence-operations">
    <div className="operator-queue-heading"><div><span className="eyebrow">Phase 9 · Evidence-backed batch records</span><h2>Evidence review <small>{items.filter((item) => item.review_status === "pending").length}</small></h2></div><span className="status-pill status-moving">Unapproved files stay private</span></div>
    <p className="passport-operator-intro">Compare each image with the specific batch claim. Approving records a OriginalRoot operator review; it is not a third-party certification.</p>
    {error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice}</div>}
    <div className="evidence-list">{items.map((item) => <article key={item.id}>
      <div className="evidence-list-heading"><span><b>{evidenceNames[item.evidence_type] || item.evidence_type} · {item.crop}</b><small>{item.id} · {item.listing_id} · {item.farm_name} · @{item.grower_username} · {item.community}</small></span><span className={`status-pill ${item.review_status === "approved" ? "status-paid" : "status-review"}`}>{statusName(item.review_status)}</span></div>
      <p>{item.caption}</p><a className="evidence-image-link" href={item.file_url} target="_blank" rel="noreferrer"><img src={item.file_url} alt={`${evidenceNames[item.evidence_type] || "Batch"} evidence for ${item.crop}`} loading="lazy" /></a>
      <div className="evidence-integrity"><span>SHA-256<b>{item.sha256}</b></span><span>File size<b>{bytesLabel(item.byte_size)}</b></span><span>Submitted<b>{formatDate(item.submitted_at)}</b></span>{item.reviewed_at && <span>Last reviewed<b>{formatDate(item.reviewed_at)} by {item.reviewed_by}</b></span>}</div>
      {item.review_note && <p className="evidence-review-note"><b>Previous review:</b> {item.review_note}</p>}
      <form className="evidence-review-form" onSubmit={(event) => decide(event, item)}><label>Decision<select name="decision" defaultValue={item.review_status === "approved" ? "declined" : "approved"}>{(item.review_status === "approved" ? ["declined"] : item.review_status === "declined" ? ["approved"] : ["approved", "declined"]).map((decision) => <option key={decision} value={decision}>{decision === "approved" ? "Approve for passport" : "Decline / withdraw"}</option>)}</select></label><label>Review note<textarea name="note" required minLength={3} maxLength={500} rows={2} placeholder="Describe what was checked and why this decision was made" /></label><button className="subtle-button" type="submit" disabled={busy}><BadgeCheck size={14} /> Save review</button></form>
      <EvidenceHistory events={item.events} />
    </article>)}{items.length === 0 && <p className="support-empty">Grower evidence submissions will appear here.</p>}</div>
    <p className="evidence-note"><ShieldCheck size={14} /> Published image evidence can be viewed by anyone with the batch passport. Check for location metadata, identity documents, customer information, and unrelated private material before approval.</p>
  </section>;
}
