import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Clock3, Leaf, LockKeyhole, LogOut, Plus, ShieldCheck } from "lucide-react";
import { GrowerSupport } from "./PhaseEight";
import { GrowerEvidence } from "./PhaseNine";

type Grower = { id: string; username: string; farm_name: string };
type GrowerOffer = { id: string; crop: string; community: string; available_quantity: number; unit: string; harvest_window: string; minimum_payout: number; status: string; approved_quantity: number | null; grade: string | null; grower_payout: number | null; buyer_price: number | null; decision_note: string; created_at: string };
const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export function GrowerWorkspace({ onShop }: { onShop: () => void }) {
  const [grower, setGrower] = useState<Grower | null>(null);
  const [offers, setOffers] = useState<GrowerOffer[]>([]);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadOffers() {
    const response = await fetch("/api/grower/listings");
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Could not load your harvest offers.");
    setOffers(result.listings || []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/grower/me").then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return null;
      return result.grower as Grower;
    }).then(async (account) => {
      if (!active) return;
      setGrower(account);
      if (account) {
        try { await loadOffers(); } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not load your offers."); }
      }
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not connect to the grower service."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = { farm_name: String(form.get("farm_name") || ""), username: String(form.get("username") || ""), password: String(form.get("password") || "") };
    try {
      const response = await fetch(`/api/grower/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not sign in.");
      setGrower(result.grower); setNotice(authMode === "register" ? "Grower profile created. Your farm identity has not been independently verified." : "Signed in to your grower workspace.");
      await loadOffers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not connect to the grower service."); }
    setBusy(false);
  }

  async function submitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = { crop: String(form.get("crop")), community: String(form.get("community")), available_quantity: Number(form.get("available_quantity")), unit: String(form.get("unit")), harvest_window: String(form.get("harvest_window")), minimum_payout: Number(form.get("minimum_payout")) };
    try {
      const response = await fetch("/api/harvest-listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not submit this offer.");
      formElement.reset(); setNotice("Offer submitted. It will stay private until the operator reviews it."); await loadOffers();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not submit this offer."); }
    setBusy(false);
  }

  async function signOut() {
    setBusy(true); setError("");
    try { await fetch("/api/grower/logout", { method: "POST" }); setGrower(null); setOffers([]); setNotice("Signed out."); }
    catch { setError("Could not sign out. Please retry."); }
    setBusy(false);
  }

  return <main className="grower-page phase-five-page">
    <div className="grower-top"><div className="wrap grower-top-inner"><div><span className="eyebrow"><span className="eyebrow-line" /> OriginalRoot grower workspace · Your account and batch records</span><h1>Your harvest.<br /><em>Your account.</em></h1><p>Keep your offers attached to your farm profile, track their review, and set the minimum payout you are willing to accept.</p><button className="text-button" onClick={onShop}>Back to the harvest board <ArrowRight size={15} /></button></div><div className="grower-illustration"><div className="grower-sky" /><span className="grower-sun" /><span className="grower-basket">🧺</span><span className="grower-crop crop-a">🥬</span><span className="grower-crop crop-b">🍅</span><span className="grower-crop crop-c">🥕</span><span className="grower-land" /><span className="grower-card-float"><Leaf size={14} /> YOUR HARVEST, YOUR TERMS</span></div></div></div>
    <div className="wrap phase-five-content">
      {error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice"><Check size={15} /> {notice}</div>}
      {loading ? <section className="panel phase-five-loading">Connecting to your local grower workspace…</section> : !grower ? <section className="panel phase-five-auth"><div><span className="eyebrow"><LockKeyhole size={13} /> Local grower account</span><h2>{authMode === "register" ? "Create your farm profile" : "Welcome back"}</h2><p>Your account keeps offers in one local profile. Use a unique password and keep it safe; password recovery is not configured.</p></div><form className="listing-form" onSubmit={authenticate}>{authMode === "register" && <label>Farm or collective name<input name="farm_name" required minLength={2} maxLength={80} placeholder="The name shown with your offers" /></label>}<label>Username<input name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.-]{3,32}" autoComplete="username" placeholder="letters, numbers, . _ -" /></label><label>Password<input name="password" required type="password" minLength={authMode === "register" ? 12 : 1} maxLength={128} autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label>{authMode === "register" && <div className="form-note"><ShieldCheck size={15} /> Use at least 12 characters. This profile does not verify your identity or farm.</div>}<button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Please wait…" : authMode === "register" ? "Create grower profile" : "Sign in"}</span><b><ArrowRight size={15} /></b></button></form><button className="phase-five-switch" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setError(""); }}>{authMode === "register" ? "Already have a local account? Sign in" : "New to this workspace? Create a profile"}</button></section> : <>
        <section className="phase-five-profile panel"><div><span className="eyebrow">Signed in as @{grower.username}</span><h2>{grower.farm_name}</h2><small>Offers you submit are linked to this local account.</small></div><button className="subtle-button" onClick={signOut} disabled={busy}><LogOut size={14} /> Sign out</button></section>
        <div className="phase-five-grid"><section className="panel phase-five-offers"><div className="panel-heading"><div><h3>My harvest offers</h3><p>Only offers submitted from this account appear here.</p></div><span className="status-pill status-review">{offers.length} total</span></div>{offers.length === 0 ? <div className="passport-empty">No offers yet. Add your first harvest when you are ready.</div> : <div className="phase-five-offer-list">{offers.map((offer) => <article className="phase-five-offer" key={offer.id}><div className="operator-listing-head"><div><span className="eyebrow">{offer.id} · {offer.community}</span><h3>{offer.crop}</h3><p>{new Date(offer.created_at).toLocaleString("en-IN")}</p></div><span className={`status-pill ${offer.status === "published" ? "status-paid" : "status-review"}`}>{offer.status}</span></div><div className="operator-request-grid"><span>Offered quantity<b>{offer.available_quantity} {offer.unit}</b></span><span>Your minimum<b>{money(offer.minimum_payout)} / {offer.unit}</b></span>{offer.approved_quantity != null && <span>Approved<b>{offer.approved_quantity} {offer.unit} · {offer.grade}</b></span>}{offer.grower_payout != null && <span>Agreed grower payout<b>{money(offer.grower_payout)} / {offer.unit}</b></span>}{offer.buyer_price != null && <span>Customer price<b>{money(offer.buyer_price)} / {offer.unit}</b></span>}</div>{offer.decision_note && <p className="phase-five-review-note"><b>Operator note:</b> {offer.decision_note}</p>}</article>)}</div>}</section>
          <section className="panel phase-five-new-offer"><div className="panel-heading"><div><h3><Plus size={16} /> Offer a harvest</h3><p>Set the lowest payout you will accept.</p></div></div><form className="listing-form" onSubmit={submitOffer}><label>Produce<input name="crop" required minLength={2} maxLength={60} placeholder="e.g. Green beans" /></label><div className="form-two"><label>Available quantity<input name="available_quantity" type="number" required min="1" max="100000" /></label><label>Unit<select name="unit" defaultValue="kg"><option>kg</option><option>500 g</option><option>250 g</option><option>bunch</option><option>dozen</option></select></label></div><div className="form-two"><label>Community<select name="community" defaultValue="Mysuru"><option>Mysuru</option><option>Mandya</option><option>Srirangapatna</option></select></label><label>Harvest window<select name="harvest_window" defaultValue="Within 1 week"><option>Within 3 days</option><option>Within 1 week</option><option>Already harvested</option></select></label></div><label>Minimum payout per unit (₹)<input name="minimum_payout" type="number" required min="1" max="1000000" /></label><div className="form-note"><Clock3 size={15} /> The offer remains private until an operator confirms the quantity, grade, and price.</div><button className="checkout-button" type="submit" disabled={busy}><span>{busy ? "Submitting…" : "Submit offer for review"}</span><b><ArrowRight size={15} /></b></button></form></section></div>
        <GrowerSupport offers={offers.map(({ id, crop }) => ({ id, crop }))} />
        <GrowerEvidence offers={offers.filter((offer) => offer.status === "pending" || offer.status === "published").map(({ id, crop, status }) => ({ id, crop, status }))} />
        <div className="phase-five-disclosure"><ShieldCheck size={15} /><span><b>Account and data note</b> Passwords are stored as salted hashes; sessions are held in the local SQLite database and expire after seven days. The account is not a verified farmer identity, and there is no password recovery yet.</span></div>
      </>}
    </div>
  </main>;
}

