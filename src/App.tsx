import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  Leaf,
  MapPin,
  MapPinned,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import productCatalog from "./catalog.json";

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

type Cart = Record<string, number>;
type ModalState = { type: "trace"; product: Product } | { type: "listing" } | { type: "demand" } | null;
const money = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

function Logo({ compact = false }: { compact?: boolean }) {
  return <a className={`brand ${compact ? "brand-compact" : ""}`} href="#top" aria-label="OriginalRoot home"><span className="brand-symbol"><Leaf size={19} strokeWidth={2.4} /></span><span className="brand-name">OriginalRoot<span>.</span></span></a>;
}

function ProductCard({ product, quantity, onAdd, onTrace }: { product: Product; quantity: number; onAdd: () => void; onTrace: () => void }) {
  return (
    <article className="product-card">
      <button className={`product-art art-${product.color}`} onClick={onTrace} aria-label={`Open ${product.name} Farm Passport`}>
        <span className="art-orbit" /><span className="product-emoji">{product.emoji}</span>
        <span className="harvest-tag"><span className="fresh-dot" /> Picked {product.harvest.toLowerCase().startsWith("today") ? "today" : "recently"}</span>
        <span className="passport-corner"><QrCode size={15} /></span>
      </button>
      <div className="product-copy">
        <div className="product-label">{product.variety}</div>
        <div className="product-title-row"><h3>{product.name}</h3><span className="grade-mark"><BadgeCheck size={14} /> {product.grade.split(" · ")[0]}</span></div>
        <button className="farm-link" onClick={onTrace}><MapPin size={13} /> {product.farm} <span>· {product.location.split(",")[0]}</span></button>
        <div className="product-bottom"><div><strong>{money(product.price)}</strong><span className="unit"> / {product.unit}</span></div><button className={`add-button ${quantity ? "added" : ""}`} onClick={onAdd} aria-label={`Add ${product.name} to bag`}>{quantity ? <><Check size={15} /> {quantity} in bag</> : <><Plus size={16} /> Add</>}</button></div>
      </div>
    </article>
  );
}

function App() {
  const [cart, setCart] = useState<Cart>(() => JSON.parse(localStorage.getItem("OriginalRoot-cart") || "{}"));
  const [mode, setMode] = useState<"shop" | "grower">("shop");
  const [category, setCategory] = useState("Everything");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState("");
  const [ordered, setOrdered] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [listingSaved, setListingSaved] = useState(false);
  const [demandSaved, setDemandSaved] = useState(false);
  const [demandLocation, setDemandLocation] = useState<"shared" | "local" | "">("");
  const [orders, setOrders] = useState(() => Number(localStorage.getItem("OriginalRoot-orders") || "0"));

  useEffect(() => { localStorage.setItem("OriginalRoot-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(""), 2600); return () => window.clearTimeout(id); }, [notice]);

  const cartCount = Object.values(cart).reduce((sum, n) => sum + n, 0);
  const subtotal = products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0);
  const delivery = cartCount ? 24 : 0;
  const total = subtotal + delivery;
  const farmerTotal = products.reduce((sum, p) => sum + p.received * (cart[p.id] || 0), 0);
  const packingTotal = products.reduce((sum, p) => sum + p.pack * (cart[p.id] || 0), 0);
  const platformTotal = products.reduce((sum, p) => sum + p.platform * (cart[p.id] || 0), 0);
  const visibleProducts = useMemo(() => products.filter((p) => (category === "Everything" || p.category === category) && `${p.name} ${p.farm} ${p.location}`.toLowerCase().includes(query.toLowerCase())), [category, query]);

  function add(product: Product, amount = 1) {
    if (amount > 0 && (cart[product.id] || 0) >= product.stock) {
      setNotice(`Only ${product.stock} sample units are listed for ${product.name}.`);
      return;
    }
    setCart((old) => ({ ...old, [product.id]: Math.max(0, (old[product.id] || 0) + amount) }));
    setOrdered(false);
    setNotice(`${product.name} ${amount > 0 ? "added to" : "updated in"} your bag`);
  }
  async function checkout() {
    if (placingOrder || cartCount === 0) return;
    setPlacingOrder(true);
    const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ product_id: productId, quantity }));
    let confirmation = "";
    try {
      const response = await fetch("/api/demo/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && response.status >= 500) throw new TypeError("The local order service is unavailable.");
      if (!response.ok) throw new Error(result.detail || "The sample order could not be recorded.");
      confirmation = `${result.reference} · recorded in the local sample ledger`;
    } catch (error) {
      if (error instanceof Error && error.message !== "Failed to fetch" && error.name !== "TypeError") {
        setNotice(error.message);
        setPlacingOrder(false);
        return;
      }
      confirmation = `LOCAL-${Date.now().toString().slice(-6)} · kept in this browser only`;
    }
    setPlacingOrder(false);
    setOrders((old) => { const next = old + 1; localStorage.setItem("OriginalRoot-orders", String(next)); return next; });
    setOrderConfirmation(confirmation);
    setCart({}); setOrdered(true); setCartOpen(false); setNotice("Sample order recorded. No payment was taken and no produce was reserved.");
  }
  function submitListing(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setListingSaved(true); setNotice("Draft saved on this device."); }
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
    <div className="app" id="top">
      <div className="announcement"><span className="announcement-dot" /> Phase 1 · Local harvest planning <span className="announcement-sep">·</span> Illustrative listings; no live sale or delivery <span className="announcement-sep">·</span> <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How OriginalRoot works <ArrowRight size={13} /></button></div>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button className="delivery-location" onClick={() => setNotice("Showing sample listings for Mysuru and nearby communities.")}><MapPin size={16} /><span><small>CONCEPT MARKET</small><b>Mysuru, Karnataka</b></span><ChevronDown size={14} /></button>
          <div className={`main-nav ${mobileNav ? "nav-open" : ""}`}>
            <button className={mode === "shop" ? "nav-active" : ""} onClick={() => { setMode("shop"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Shop the harvest</button>
            <a href="#how-it-works" onClick={() => setMobileNav(false)}>How it works</a>
            <button className={mode === "grower" ? "nav-active" : ""} onClick={() => { setMode("grower"); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>For growers</button>
          </div>
          <div className="header-actions"><button className="icon-button account-button" onClick={() => setMode(mode === "shop" ? "grower" : "shop")} title="Switch view"><UsersRound size={18} /></button><button className="bag-button" onClick={() => setCartOpen(true)}><ShoppingBag size={17} /><span>Your bag</span>{cartCount > 0 && <b>{cartCount}</b>}</button><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button></div>
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
            <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Fresh from the farms</div><h2>This week’s <em>harvest</em></h2><p>Illustrative seasonal listings for Mysuru and nearby homes.</p></div><button className="season-note" onClick={() => setNotice("Seasonal availability changes with each harvest.")}><span className="season-icon"><Sprout size={16} /></span><span><b>In season, right now</b><small>Available around Mysuru</small></span><ArrowRight size={15} /></button></div>
            <div className="demand-banner"><div><span className="demand-banner-icon"><Sprout size={18} /></span><span><b>Help growers plan the next harvest</b><small>Share what your household would buy. No name, phone, payment, or commitment needed.</small></span></div><button className="button button-dark" onClick={() => { setDemandSaved(false); setDemandLocation(""); setModal({ type: "demand" }); }}>Add a demand signal <ArrowRight size={15} /></button></div>
        <div className="catalog-tools"><div className="category-tabs">{["Everything", "Vegetables", "Fruit", "Greens", "Pantry"].map((item) => <button key={item} className={category === item ? "tab-selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find something good..." /></label></div>
            <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onAdd={() => add(product)} onTrace={() => setModal({ type: "trace", product })} />)}</div>
            {visibleProducts.length === 0 && <div className="empty-search"><span>🌱</span><b>Nothing in this patch yet.</b><small>Try another search or browse the full harvest.</small><button onClick={() => { setCategory("Everything"); setQuery(""); }}>Clear filters</button></div>}
            <div className="harvest-footnote"><Leaf size={15} /><span>Harvests are small on purpose. When a batch is gone, it comes back with the next picking.</span></div>
          </section>

          <section className="how-section" id="how-it-works"><div className="wrap how-wrap"><div className="how-intro"><div className="eyebrow"><span className="eyebrow-line" /> A simpler path to your plate</div><h2>Closer to the grower.<br /><em>Clearer</em> by the kilo.</h2><p>OriginalRoot coordinates the useful work between the farm and your door—and shows you what happened along the way.</p><button className="text-button" onClick={() => setModal({ type: "trace", product: products[0] })}>See a sample Farm Passport <ArrowRight size={15} /></button></div><div className="steps-grid"><div className="step-card"><span className="step-no">01</span><span className="step-icon"><Sprout size={20} /></span><h3>Meet the grower</h3><p>Every listing names the farmer or collective and where the crop comes from.</p><span className="step-detail"><MapPinned size={14} /> Farm and batch linked</span></div><div className="step-card"><span className="step-no">02</span><span className="step-icon"><ClipboardCheck size={20} /></span><h3>Know the grade</h3><p>Clear handling notes and honest grading. Cosmetic seconds can have a place, too.</p><span className="step-detail"><BadgeCheck size={14} /> No vague quality claims</span></div><div className="step-card"><span className="step-no">03</span><span className="step-icon"><WalletCards size={20} /></span><h3>See the split</h3><p>Understand the farmer’s share and the cost of packing and delivery.</p><span className="step-detail"><QrCode size={14} /> Scan the Farm Passport</span></div></div></div></section>

          <section className="farmer-cta wrap"><div className="cta-art"><span className="cta-sun" /><span className="cta-field" /><span className="cta-person">🧑🏽‍🌾</span><span className="cta-plant">🌾</span><span className="cta-note">Built with<br />growers in mind</span></div><div className="cta-copy"><div className="eyebrow"><span className="eyebrow-line" /> For the people who grow</div><h2>Your harvest deserves<br />a <em>better conversation.</em></h2><p>Bring your produce, your standards, and your voice. OriginalRoot is built to make offers, grading, and payments easier to see and question.</p><div className="cta-points"><span><Check size={14} /> Clear weights and grading notes</span><span><Check size={14} /> A payout record you can follow</span><span><Check size={14} /> Sell now or plan a confirmed order</span></div><button className="button button-dark" onClick={() => setMode("grower")}>Explore the grower space <ArrowRight size={16} /></button></div></section>
        </main>
        <footer className="site-footer"><div className="wrap footer-top"><div><Logo /><p>Good food has a real starting point.<br />We’re making it easier to see.</p></div><div className="footer-links"><a href="#the-harvest">Shop the harvest</a><a href="#how-it-works">How it works</a><button onClick={() => setMode("grower")}>Grow with OriginalRoot</button></div><div className="footer-location"><span className="fresh-dot" /> Pilot focus <b>Mysuru & nearby</b><small>Farm and product records are illustrative</small></div></div><div className="wrap footer-bottom"><span>© 2026 OriginalRoot · A local-first food network</span><span>Clear records. Fair terms. No scarcity games.</span><button onClick={() => setNotice("Listings are illustrative. The local API records anonymous demand only; it does not accept orders, take payments, or arrange delivery.")}>Data & service note</button></div></footer>
      </> : <GrowerSpace onShop={() => setMode("shop")} onNewListing={() => { setListingSaved(false); setModal({ type: "listing" }); }} orders={orders} />}

      {cartOpen && <div className="drawer-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}><aside className="cart-drawer"><div className="drawer-head"><div><span className="eyebrow">Your basket</span><h2>{cartCount ? `${cartCount} good ${cartCount === 1 ? "thing" : "things"}` : "Room for something fresh?"}</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={19} /></button></div>{ordered && <div className="order-success"><CircleCheck size={20} /><span><b>Sample order recorded.</b><small>{orderConfirmation}</small><small>No payment was taken; no produce was reserved.</small></span></div>}{cartCount === 0 ? <div className="empty-bag"><span>🧺</span><p>Your bag is waiting for this week’s harvest.</p><button className="button button-dark" onClick={() => { setCartOpen(false); document.getElementById("the-harvest")?.scrollIntoView({ behavior: "smooth" }); }}>Browse the harvest <ArrowRight size={15} /></button></div> : <><div className="cart-items">{products.filter((p) => cart[p.id]).map((product) => <div className="cart-line" key={product.id}><span className={`cart-thumb art-${product.color}`}>{product.emoji}</span><div className="cart-line-main"><b>{product.name}</b><small>{money(product.price)} / {product.unit}</small><button className="cart-trace-link" onClick={() => setModal({ type: "trace", product })}><QrCode size={12} /> Meet this batch</button></div><div className="qty-control"><button onClick={() => add(product, -1)} aria-label="Remove one"><Minus size={12} /></button><span>{cart[product.id]}</span><button onClick={() => add(product)} aria-label="Add one"><Plus size={12} /></button></div></div>)}</div><div className="price-waterfall"><div className="waterfall-title"><span>Where your money goes</span><span>Per order</span></div><div><span>Growers receive</span><b>{money(farmerTotal)}</b></div><div><span>Sorting & packing</span><b>{money(packingTotal)}</b></div><div><span>OriginalRoot coordination</span><b>{money(platformTotal)}</b></div><div><span>Local delivery</span><b>{money(delivery)}</b></div><div className="waterfall-total"><span>You pay</span><b>{money(total)}</b></div><small>Illustrative price split. Actual prices depend on crop, batch, and route.</small></div><button className="checkout-button" onClick={checkout} disabled={placingOrder}><span>{placingOrder ? "Recording sample order…" : "Continue to checkout"}</span><b>{money(total)} <ArrowRight size={16} /></b></button><div className="drawer-assurance"><ShieldCheck size={15} /> No payment is collected in this prototype.</div></>}</aside></div>}

      {modal?.type === "trace" && <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="passport-modal"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><div className={`passport-cover art-${modal.product.color}`}><span className="passport-kicker"><QrCode size={15} /> OriginalRoot FARM PASSPORT</span><span className="passport-emoji">{modal.product.emoji}</span><span className="passport-batch">BATCH {modal.product.batch}</span></div><div className="passport-content"><div className="passport-title-row"><div><span className="eyebrow">A little more about your food</span><h2>{modal.product.name}</h2><p>{modal.product.variety}</p></div><span className="grade-pill"><BadgeCheck size={14} /> {modal.product.grade}</span></div><div className="grower-card"><span className="grower-avatar">{modal.product.farm.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}</span><span><b>{modal.product.farm}</b><small><MapPin size={12} /> {modal.product.location}</small></span><span className="verified-chip"><ShieldCheck size={13} /> Sample profile</span></div><div className="trace-timeline"><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Picked at the farm</b><small>{modal.product.harvest}</small></div></div><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Weighed and graded</b><small>Collection point · {modal.product.grade}</small></div></div><div className="timeline-item complete"><span><Check size={12} /></span><div><b>Packed for the local route</b><small>Batch {modal.product.batch}</small></div></div><div className="timeline-item upcoming"><span><Truck size={12} /></span><div><b>Delivered to your neighbourhood</b><small>Route grouped to reduce extra trips</small></div></div></div><div className="passport-note"><ShieldCheck size={16} /><span><b>What this proves</b><small>These example records illustrate batch details. A real Farm Passport needs field checks and operator records.</small></span></div></div></section></div>}

      {modal?.type === "listing" && <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><span className="eyebrow">Grower space · New harvest</span><h2>Start a listing</h2><p>Share what’s growing. A OriginalRoot field partner will confirm grade, quantity, and buyer demand before anything is published.</p>{listingSaved ? <div className="saved-state"><CircleCheck size={24} /><b>Draft saved on this device</b><span>This prototype has not sent your details anywhere. A real listing would be reviewed with you first.</span><button className="button button-dark" onClick={() => setModal(null)}>Done</button></div> : <form className="listing-form" onSubmit={submitListing}><label>What are you growing?<input required placeholder="e.g. Green beans" /></label><div className="form-two"><label>Expected quantity<input required type="number" min="1" placeholder="kg" /></label><label>Ready to harvest<select defaultValue=""><option value="" disabled>Choose a window</option><option>Within 3 days</option><option>Within 1 week</option><option>Already harvested</option></select></label></div><label>Farm or collective name<input required placeholder="Your name or FPO" /></label><div className="form-note"><ShieldCheck size={15} /> This is a private draft. We never publish an offer before you review its grade and price.</div><button className="checkout-button" type="submit"><span>Save harvest draft</span><b>Continue <ArrowRight size={15} /></b></button></form>}</section></div>}

      {modal?.type === "demand" && <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="listing-modal"><button className="modal-close icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button><span className="eyebrow">Community harvest planning</span><h2>What would you buy?</h2><p>Your anonymous signal helps estimate local demand before a grower decides what to harvest. It is not an order or reservation.</p>{demandSaved ? <div className="saved-state"><CircleCheck size={24} /><b>Demand signal recorded</b><span>{demandLocation === "shared" ? "Shared with this OriginalRoot local-pilot workspace." : "Saved on this device only. This GitHub Pages site has no shared service connected."} No personal details were collected.</span><button className="button button-dark" onClick={() => setModal(null)}>Done</button></div> : <form className="listing-form" onSubmit={submitDemand}><label>Produce<select name="product_id" defaultValue={products[0].id}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className="form-two"><label>Community<select name="community" defaultValue="Mysuru"><option>Mysuru</option><option>Mandya</option><option>Srirangapatna</option></select></label><label>Household units<select name="quantity" defaultValue="1"><option value="1">1 unit</option><option value="2">2 units</option><option value="3">3 units</option></select></label></div><div className="form-note"><ShieldCheck size={15} /> Anonymous demand planning only. No contact details, money, or purchase promise.</div><button className="checkout-button" type="submit"><span>Share demand signal</span><b>Continue <ArrowRight size={15} /></b></button></form>}</section></div>}

      {notice && <div className="toast"><CircleCheck size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
      <button className="floating-bag" onClick={() => setCartOpen(true)}><ShoppingBag size={17} /> Bag {cartCount > 0 && <b>{cartCount}</b>}</button>
    </div>
  );
}

function GrowerSpace({ onShop, onNewListing, orders }: { onShop: () => void; onNewListing: () => void; orders: number }) {
  return <main className="grower-page"><div className="grower-top"><div className="wrap grower-top-inner"><div><span className="eyebrow"><span className="eyebrow-line" /> OriginalRoot grower space</span><h1>Your harvest.<br /><em>Your terms.</em></h1><p>A clearer view of what’s listed, what’s moving, and what has been paid. This is a sample workspace with fictional figures.</p><div className="grower-actions"><button className="button button-dark" onClick={onNewListing}><Plus size={16} /> Add a harvest</button><button className="text-button" onClick={onShop}>See the customer shop <ArrowRight size={15} /></button></div></div><div className="grower-illustration"><div className="grower-sky" /><span className="grower-sun" /><span className="grower-basket">🧺</span><span className="grower-crop crop-a">🥬</span><span className="grower-crop crop-b">🍅</span><span className="grower-crop crop-c">🥕</span><span className="grower-land" /><span className="grower-card-float"><CircleCheck size={14} /> YOUR RECORDS, IN ONE PLACE</span></div></div></div>
    <div className="wrap grower-dashboard"><div className="dashboard-welcome"><div><span className="eyebrow">Good morning, Savitri <span>✳</span></span><h2>Your farm at a glance</h2></div><button className="date-pill"><CalendarDays size={15} /> This week <ChevronDown size={13} /></button></div><div className="sample-banner"><ShieldCheck size={16} /><span><b>Sample workspace</b> These figures are fictional and do not represent real orders, farmer payments, or farm verification.</span></div><div className="stat-grid"><div className="stat-card"><span className="stat-icon green"><WalletCards size={18} /></span><span className="stat-label">Paid to you</span><b>₹18,460</b><small><ArrowUpRight size={13} /> Settled for 12 batches</small></div><div className="stat-card"><span className="stat-icon peach"><PackageCheck size={18} /></span><span className="stat-label">Accepted produce</span><b>486 kg</b><small>Across 4 harvests</small></div><div className="stat-card"><span className="stat-icon yellow"><ShoppingBag size={18} /></span><span className="stat-label">Buyer orders</span><b>{orders > 0 ? orders : 28}</b><small>Confirmed for this week</small></div><div className="stat-card"><span className="stat-icon blue"><Clock3 size={18} /></span><span className="stat-label">Awaiting settlement</span><b>₹2,140</b><small>Due after acceptance</small></div></div>
    <div className="grower-content-grid"><section className="panel harvest-panel"><div className="panel-heading"><div><h3>My harvests</h3><p>Offers, grades, and where each batch stands.</p></div><button className="subtle-button" onClick={onNewListing}><Plus size={14} /> Add harvest</button></div><div className="table-wrap"><table><thead><tr><th>PRODUCE</th><th>QUANTITY</th><th>GRADE</th><th>STATUS</th><th>YOUR PAYOUT</th></tr></thead><tbody><tr><td><span className="table-produce">🍅 <span><b>Desi tomatoes</b><small>VAV-MDY-2410-08</small></span></span></td><td>120 kg</td><td><span className="grade-mark"><BadgeCheck size={13} /> Grade A</span></td><td><span className="status-pill status-moving"><span /> In delivery</span></td><td className="payout-cell">₹6,000</td></tr><tr><td><span className="table-produce">🥬 <span><b>Tender spinach</b><small>VAV-MDY-2410-03</small></span></span></td><td>86 kg</td><td><span className="grade-mark"><BadgeCheck size={13} /> Grade A</span></td><td><span className="status-pill status-paid"><Check size={11} /> Paid</span></td><td className="payout-cell">₹6,192</td></tr><tr><td><span className="table-produce">🫛 <span><b>French beans</b><small>VAV-MYS-2410-04</small></span></span></td><td>64 kg</td><td><span className="grade-mark"><BadgeCheck size={13} /> Grade A</span></td><td><span className="status-pill status-review"><Clock3 size={11} /> Checking</span></td><td className="payout-cell">₹2,880 est.</td></tr><tr><td><span className="table-produce">🥕 <span><b>Hill carrots</b><small>VAV-CNR-2409-11</small></span></span></td><td>52 kg</td><td><span className="grade-mark"><BadgeCheck size={13} /> Grade A</span></td><td><span className="status-pill status-paid"><Check size={11} /> Paid</span></td><td className="payout-cell">₹3,388</td></tr></tbody></table></div><div className="panel-foot"><span><ShieldCheck size={14} /> Every weight, grade, and deduction should have a record.</span><button onClick={() => alert("Sample ledger: no real payout records are connected.")}>View payout ledger <ArrowRight size={13} /></button></div></section>
    <aside className="panel payout-panel"><div className="panel-heading"><div><h3>Payment activity</h3><p>Sample settlement trail</p></div><button className="icon-button" aria-label="More payment activity"><Activity size={17} /></button></div><div className="payout-summary"><span>PAID THIS MONTH</span><b>₹18,460</b><small><ArrowUpRight size={13} /> Clear record for every payout</small></div><div className="payout-row"><span className="payout-dot paid"><ArrowDownLeft size={14} /></span><span><b>Spinach batch accepted</b><small>Today · 86 kg · UPI transfer</small></span><strong>+₹6,192</strong></div><div className="payout-row"><span className="payout-dot paid"><ArrowDownLeft size={14} /></span><span><b>Carrots batch accepted</b><small>Yesterday · 52 kg · UPI transfer</small></span><strong>+₹3,388</strong></div><div className="payout-row"><span className="payout-dot pending"><Clock3 size={14} /></span><span><b>Tomato order delivery</b><small>After buyer delivery · 120 kg</small></span><strong className="pending-amount">₹6,000</strong></div><button className="ledger-button" onClick={() => alert("Sample ledger: no real payout records are connected.")}>Open full payout ledger <ArrowRight size={14} /></button></aside></div>
    <div className="grower-bottom-grid"><section className="panel farmer-promise"><div className="promise-icon"><ShieldCheck size={20} /></div><div><h3>Know your terms before you say yes.</h3><p>Review the grade, expected net payout, handling cost, and buyer demand before accepting an offer.</p><button onClick={() => alert("Farmer protection charter preview.")}>Read the grower charter <ArrowRight size={14} /></button></div></section><section className="panel quick-guide"><div className="guide-heading"><span className="guide-icon"><ClipboardCheck size={17} /></span><span><b>Before a batch goes live</b><small>Your field partner confirms it with you.</small></span></div><div className="guide-steps"><span><i>1</i> Weigh together</span><span><i>2</i> Agree on grade</span><span><i>3</i> Confirm payout</span></div></section></div><div className="grower-help"><span>Need a hand?</span><b>Call your OriginalRoot field partner</b><small>In a real pilot, help should be available in your preferred language.</small><button onClick={() => alert("A local support contact will be added for each pilot area.")}>Get support <ArrowRight size={13} /></button></div></div>
  </main>;
}

export default App;

