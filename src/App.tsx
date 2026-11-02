import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  Leaf,
  MapPin,
  MapPinned,
  Menu,
  QrCode,
  ShieldCheck,
  Sprout,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import productCatalog from "./catalog.json";
import { BrandSite } from "./BrandSite";
import { OperatorSpace, OrderRequestModal, OrderTrackingModal, PublishedHarvests, type PublishedOffer } from "./PhaseTwo";
import { BatchPassportModal } from "./PhaseFour";
import { GrowerWorkspace } from "./PhaseFive";
import { CustomerWorkspace } from "./PhaseFourteen";

type Product = {
  id: string;
  name: string;
  variety: string;
  farm: string;
  location: string;
  price: number;
  unit: string;
  harvest: string;
  category: string;
  emoji: string;
  color: string;
  batch: string;
  received: number;
  pack: number;
  platform: number;
  grade: string;
  stock: number;
  description: string;
};

const products = productCatalog as Product[];

type ModalState = { type: "trace"; product: Product } | { type: "demand" } | { type: "order"; listing: PublishedOffer } | { type: "passport"; listing: PublishedOffer } | { type: "track" } | null;

function Logo({ compact = false }: { compact?: boolean }) {
  return <a className={`brand ${compact ? "brand-compact" : ""}`} href="#top" aria-label="OriginalRoot home"><span className="brand-symbol"><Leaf size={19} strokeWidth={2.4} /></span><span className="brand-name">OriginalRoot<span>.</span></span></a>;
}

type Workspace = "shop" | "grower" | "operator" | "customer";

function currentWorkspace(): Workspace {
  const workspace = new URLSearchParams(window.location.search).get("workspace");
  return workspace === "grower" || workspace === "operator" || workspace === "customer" ? workspace : "shop";
}

function isPlatformRoute(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("platform") === "1" || params.has("passport") || params.has("workspace");
}

function MarketplaceApp() {
  const [mode, setModeState] = useState<Workspace>(currentWorkspace);
  function setMode(next: Workspace) {
    setModeState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("platform", "1");
    url.searchParams.set("workspace", next);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [demandSaved, setDemandSaved] = useState(false);
  const [demandLocation, setDemandLocation] = useState<"shared" | "local" | "">("");
  const [publishedOffers, setPublishedOffers] = useState<PublishedOffer[]>([]);
  const [orderRequestsAvailable, setOrderRequestsAvailable] = useState(false);
  const [marketStatus, setMarketStatus] = useState<"loading" | "connected" | "offline">("loading");

  useEffect(() => {
    const syncWorkspace = () => setModeState(currentWorkspace());
    window.addEventListener("popstate", syncWorkspace);
    return () => window.removeEventListener("popstate", syncWorkspace);
  }, []);
  async function loadPublishedOffers() {
    setMarketStatus("loading");
    try {
      const response = await fetch("/api/harvest-listings");
      if (!response.ok) throw new Error("Marketplace service unavailable");
      const result = await response.json();
      const listings: PublishedOffer[] = result?.listings || [];
      setPublishedOffers(listings);
      setMarketStatus("connected");
      const sharedPassport = new URLSearchParams(window.location.search).get("passport");
      const listing = listings.find((offer) => offer.id === sharedPassport);
      if (listing) setModal({ type: "passport", listing });
    } catch {
      setPublishedOffers([]);
      setMarketStatus("offline");
    }
  }
  useEffect(() => { void loadPublishedOffers(); }, []);
  useEffect(() => { fetch("/api/health").then((response) => response.ok ? response.json() : null).then((result) => setOrderRequestsAvailable(Boolean(result?.order_requests_enabled))).catch(() => setOrderRequestsAvailable(false)); }, []);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 2600); return () => window.clearTimeout(id); }, [notice]);

  function showShop() {
    setMode("shop");
    void loadPublishedOffers();
  }

  async function submitDemand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const signal = { product_id: String(form.get("product_id")), community: String(form.get("community")), quantity: Number(form.get("quantity")) };
    try {
      const response = await fetch("/api/harvest-demand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(signal) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 404 && response.status !== 405) {
        setNotice(result.detail || "Could not record the harvest signal.");
        return;
      }
      if (!response.ok) throw new TypeError("Shared demand service is not connected.");
      setDemandLocation("shared");
    } catch (error) {
      if (!(error instanceof TypeError)) {
        setNotice("Could not reach the demand service. Try again.");
        return;
      }
      const saved = JSON.parse(localStorage.getItem("OriginalRoot-demand-signals") || "[]") as typeof signal[];
      saved.push(signal);
      localStorage.setItem("OriginalRoot-demand-signals", JSON.stringify(saved));
      setDemandLocation("local");
    }
    setDemandSaved(true);
  }

  return (
    <div className="app platform-mode" id="top">
      <div className="announcement"><span className="announcement-dot" /> OriginalRoot platform <span className="announcement-sep">·</span> Marketplace, grower workspace, and local operations <span className="announcement-sep">·</span> <a href={(() => { const url = new URL(window.location.href); url.search = ""; url.hash = ""; return `${url.pathname}`; })()}>About OriginalRoot <ArrowRight size={13} /></a></div>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button className="delivery-location" onClick={() => setNotice("This local workspace is configured for Mysuru and nearby communities.")}><MapPin size={16} /><span><small>LOCAL MARKET</small><b>Mysuru, Karnataka</b></span><ChevronDown size={14} /></button>
          <div className={`main-nav ${mobileNav ? "nav-open" : ""}`}>
            <button className={mode === "shop" ? "nav-active" : ""} onClick={() => { setMode("shop"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Marketplace</button>
            <button className={mode === "grower" ? "nav-active" : ""} onClick={() => { setMode("grower"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Grower workspace</button>
            <button className={mode === "operator" ? "nav-active" : ""} onClick={() => { setMode("operator"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Operations</button>
            <button className={mode === "customer" ? "nav-active" : ""} onClick={() => { setMode("customer"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>My orders</button>
            <button onClick={() => { setModal({ type: "track" }); setMobileNav(false); }}>Track order</button>
          </div>
          <div className="header-actions"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button></div>
        </div>
      </header>

      {mode === "shop" ? <>
        <main>
          <section className="hero wrap">
            <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> A closer kind of food system</div><h1>Good food has<br />a <em>real</em> starting point.</h1><p>Meet the growers behind your everyday food. See when it was picked, how it was graded, and where your money goes.</p><div className="hero-actions"><button className="button button-dark" onClick={() => document.getElementById("the-harvest")?.scrollIntoView({ behavior: "smooth" })}>Shop this week’s harvest <ArrowRight size={16} /></button><button className="text-button" onClick={() => setMode("grower")}>I grow food <ArrowRight size={15} /></button></div><div className="hero-proof"><div className="mini-avatars"><i>LR</i><i>SK</i><i>AM</i><i>+</i></div><span><b>Grown close. Accounted for.</b><small>Designed for farmers and local collectives</small></span></div></div>
            <div className="hero-visual"><div className="hero-image"><div className="sun-disc" /><div className="hill hill-back" /><div className="hill hill-front" /><div className="field-row row-one" /><div className="field-row row-two" /><div className="field-row row-three" /><div className="field-row row-four" /><span className="hero-produce tomato-one">🍅</span><span className="hero-produce leaf-one">🌿</span><span className="hero-produce tomato-two">🍅</span><span className="hero-produce leaf-two">🌱</span><span className="hero-label label-top"><span className="fresh-dot" /> Picked at 6:10 am</span><span className="hero-label label-bottom"><span className="label-icon"><QrCode size={15} /></span><span><b>Every batch has a story</b><small>Scan the OriginalRoot Passport</small></span></span><div className="hero-stamp">GROWN<br />WITH CARE</div></div><span className="visual-caption">A morning in Mandya, Karnataka <span>·</span> This week’s harvest</span></div>
          </section>

          <section className="trust-strip"><div className="wrap trust-inner"><div><ShieldCheck size={19} /><span><b>Known origin</b><small>Farmer and batch details</small></span></div><div><ClipboardCheck size={19} /><span><b>Clear quality</b><small>Grades with a real standard</small></span></div><div><WalletCards size={19} /><span><b>Open pricing</b><small>See the price split</small></span></div><div><Truck size={19} /><span><b>Careful delivery</b><small>Grouped local routes</small></span></div></div></section>

          <section className="harvest-section wrap" id="the-harvest">
            <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Local marketplace</div><h2>Grower-approved <em>harvests</em></h2><p>Only current offers from the connected local OriginalRoot service can be requested.</p></div></div>
            {marketStatus === "loading" ? <div className="approved-empty"><span>⏳</span><div><b>Connecting to the local marketplace…</b><small>Checking for current, reviewed grower offers.</small></div></div> : marketStatus === "offline" ? <div className="approved-empty"><span>🔌</span><div><b>The marketplace service is not connected.</b><small>GitHub Pages is an information site without shared data. Start the local Docker app to use the shared marketplace and order-request service.</small><button className="text-button" onClick={() => void loadPublishedOffers()}>Try again <ArrowRight size={14} /></button></div></div> : <PublishedHarvests listings={publishedOffers} canOrder={orderRequestsAvailable} onOrder={(listing) => setModal({ type: "order", listing })} onPassport={(listing) => setModal({ type: "passport", listing })} />}
            <div className="demand-banner"><div><span className="demand-banner-icon"><Sprout size={18} /></span><span><b>Help growers plan the next harvest</b><small>Share what your household would buy. No name, phone, payment, or commitment needed.</small></span></div><button className="button button-dark" onClick={() => { setDemandSaved(false); setDemandLocation(""); setModal({ type: "demand" }); }}>Add a demand signal <ArrowRight size={15} /></button></div>
          </section>

          <section className="how-section" id="how-it-works"><div className="wrap how-wrap"><div className="how-intro"><div className="eyebrow"><span className="eyebrow-line" /> A simpler path to your plate</div><h2>Closer to the grower.<br /><em>Clearer</em> by the kilo.</h2><p>OriginalRoot coordinates the useful work between the farm and your door—and shows you what happened along the way.</p><button className="text-button" onClick={() => setModal({ type: "trace", product: products[0] })}>See a sample Farm Passport <ArrowRight size={15} /></button></div><div className="steps-grid"><div className="step-card"><span className="step-no">01</span><span className="step-icon"><Sprout size={20} /></span><h3>Meet the grower</h3><p>Every listing names the farmer or collective and where the crop comes from.</p><span className="step-detail"><MapPinned size={14} /> Farm and batch linked</span></div><div className="step-card"><span className="step-no">02</span><span className="step-icon"><ClipboardCheck size={20} /></span><h3>Know the grade</h3><p>Clear handling notes and honest grading. Cosmetic seconds can have a place, too.</p><span className="step-detail"><BadgeCheck size={14} /> No vague quality claims</span></div><div className="step-card"><span className="step-no">03</span><span className="step-icon"><WalletCards size={20} /></span><h3>See the split</h3><p>Understand the farmer’s share and the cost of packing and delivery.</p><span className="step-detail"><QrCode size={14} /> Scan the Farm Passport</span></div></div></div></section>

          <section className="farmer-cta wrap"><div className="cta-art"><span className="cta-sun" /><span className="cta-field" /><span className="cta-person">🧑🏽‍🌾</span><span className="cta-plant">🌾</span><span className="cta-note">Built with<br />growers in mind</span></div><div className="cta-copy"><div className="eyebrow"><span className="eyebrow-line" /> For the people who grow</div><h2>Your harvest deserves<br />a <em>better conversation.</em></h2><p>Bring your produce, your standards, and your voice. OriginalRoot is built to make offers, grading, and payments easier to see and question.</p><div className="cta-points"><span><Check size={14} /> Clear weights and grading notes</span><span><Check size={14} /> A payout record you can follow</span><span><Check size={14} /> Sell now or plan a confirmed order</span></div><button className="button button-dark" onClick={() => setMode("grower")}>Explore the grower space <ArrowRight size={16} /></button></div></section>
        </main>
        <footer className="site-footer"><div className="wrap footer-top"><div><Logo /><p>Good food has a real starting point.<br />We’re making it easier to see.</p></div><div className="footer-links"><a href="#the-harvest">Browse harvest</a><a href={(() => { const url = new URL(window.location.href); url.search = ""; url.hash = ""; return url.pathname; })()}>About OriginalRoot</a><button onClick={() => setMode("grower")}>Grow with OriginalRoot</button><button onClick={() => setModal({ type: "track" })}>Track an order</button></div><div className="footer-location"><span className="fresh-dot" /> Local focus <b>Mysuru & nearby</b><small>Example catalog; live listings require local review</small></div></div><div className="wrap footer-bottom"><span>© 2026 OriginalRoot · A local-first food network</span><span>Clear records. Fair terms. No scarcity games.</span><button onClick={() => setNotice("The local API supports grower offers, review, orders, support, and delivery handoffs. Payments are not enabled; GitHub Pages has no shared database.")}>Data & service note</button></div></footer>
      </> : mode === "grower" ? <GrowerWorkspace onShop={showShop} /> : mode === "customer" ? <CustomerWorkspace onShop={showShop} /> : <OperatorSpace onShop={showShop} />}


      {modal?.type === "trace" && <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="passport-modal"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><div className={`passport-cover art-${modal.product.color}`}><span className="passport-kicker"><QrCode size={15} /> OriginalRoot FARM PASSPORT</span><span className="passport-emoji">{modal.product.emoji}</span><span className="passport-batch">BATCH {modal.product.batch}</span></div><div className="passport-content"><div className="passport-title-row"><div><span className="eyebrow">A little more about your food</span><h2>{modal.product.name}</h2><p>{modal.product.variety}</p></div><span className="grade-pill"><BadgeCheck size={14} /> {modal.product.grade}</span></div><div className="grower-card"><span className="grower-avatar">{modal.product.farm.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</span><span><b>{modal.product.farm}</b><small><MapPin size={12} /> {modal.product.location}</small></span><span className="verified-chip"><ShieldCheck size={13} /> Sample profile</span></div><div className="trace-timeline"><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Picked at the farm</b><small>{modal.product.harvest}</small></div></div><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Weighed and graded</b><small>Collection point · {modal.product.grade}</small></div></div><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Packed for the local route</b><small>Batch {modal.product.batch}</small></div></div><div className="timeline-item upcoming"><span><Truck size={12} /></span><div><b>Delivered to your neighbourhood</b><small>Route grouped to reduce extra trips</small></div></div></div><div className="passport-note"><ShieldCheck size={16} /><span><b>What this proves</b><small>These example records illustrate batch details. A real Farm Passport needs field checks and operator records.</small></span></div></div></section></div>}


      {modal?.type === "demand" && <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><span className="eyebrow">Community harvest planning</span><h2>What would you buy?</h2><p>Your anonymous signal helps estimate local demand before a grower decides what to harvest. It is not an order or reservation.</p>{demandSaved ? <div className="saved-state"><CircleCheck size={24} /><b>Demand signal recorded</b><span>{demandLocation === "shared" ? "Shared with this OriginalRoot local-pilot workspace." : "Saved on this device only. This GitHub Pages site has no shared service connected."} No personal details were collected.</span><button className="button button-dark" onClick={() => setModal(null)}>Done</button></div> : <form className="listing-form" onSubmit={submitDemand}><label>Produce<select name="product_id" defaultValue={products[0].id}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className="form-two"><label>Community<select name="community" defaultValue="Mysuru"><option>Mysuru</option><option>Mandya</option><option>Srirangapatna</option></select></label><label>Household units<select name="quantity" defaultValue="1"><option value="1">1 unit</option><option value="2">2 units</option><option value="3">3 units</option></select></label></div><div className="form-note"><ShieldCheck size={15} /> Anonymous demand planning only. No contact details, money, or purchase promise.</div><button className="checkout-button" type="submit"><span>Share demand signal</span><b>Continue <ArrowRight size={15} /></b></button></form>}</section></div>}

      {modal?.type === "order" && <OrderRequestModal listing={modal.listing} onClose={() => setModal(null)} />}
      {modal?.type === "passport" && <BatchPassportModal listing={modal.listing} onClose={() => setModal(null)} />}
      {modal?.type === "track" && <OrderTrackingModal onClose={() => setModal(null)} />}

      {notice && <div className="toast"><CircleCheck size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
    </div>
  );
}

export default function App() {
  const [platform, setPlatform] = useState(isPlatformRoute);
  useEffect(() => {
    const syncRoute = () => setPlatform(isPlatformRoute());
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  return platform ? <MarketplaceApp /> : <BrandSite />;
}

