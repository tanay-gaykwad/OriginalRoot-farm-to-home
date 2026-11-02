import { useState } from "react";
import { ArrowDownRight, ArrowRight, BadgeCheck, BarChart3, ChevronDown, CircleCheck, ClipboardCheck, Eye, HandCoins, Leaf, MapPin, PackageCheck, ShieldCheck, ShoppingBasket, Sprout, Truck, Wheat } from "lucide-react";

type Workspace = "shop" | "prices" | "grower" | "customer" | "operator";

function platformHref(workspace: Workspace = "shop", feature?: string) {
  const url = new URL(window.location.href);
  const params = new URLSearchParams({ platform: "1", workspace });
  if (feature) params.set("feature", feature);
  url.search = params.toString();
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function BrandLogo() {
  return <a className="or-brand" href="#top" aria-label="OriginalRoot home"><span className="or-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 35V18M24 25c-7 0-12-4-14-11 8 0 13 3 14 11Zm0-6c0-8 5-13 13-15 0 9-3 15-13 19ZM24 31c-5 0-8 3-11 7m11-7c5 0 8 3 11 7m-11-4v6" /></svg></span><span>OriginalRoot</span></a>;
}

const stories = [
  { eyebrow: "01 / THE OFFER", title: "The grower names the terms.", copy: "A farmer or collective records the crop, available quantity, harvest window and minimum payout they will accept. The offer stays private while it is reviewed.", Icon: Sprout, proof: "An offer starts with the person who grew it." },
  { eyebrow: "02 / THE REVIEW", title: "The price is opened up.", copy: "A local operator checks the offer with its grower, then records the agreed grade, quantity and costs. Customers can see the grower share beside handling and route costs.", Icon: Eye, proof: "Review is recorded. It is not a promise of independent certification." },
  { eyebrow: "03 / THE HANDOFF", title: "The harvest keeps its trail.", copy: "A customer requests what is available. The local team confirms pickup or delivery, records each status and closes delivery with a one-time handoff code.", Icon: Truck, proof: "One order. One visible status history." },
];

export function BrandSite() {
  const [activeStory, setActiveStory] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const story = stories[activeStory];
  const StoryIcon = story.Icon;
  return <div className="or-site" id="top">
    <div className="or-topline"><span className="or-live-mark" /> A shorter route from harvest to home <span className="or-topline-note">Starting with Mysuru and nearby communities</span></div>
    <header className="or-header">
      <BrandLogo />
      <button className="or-menu-button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
      <nav className={menuOpen ? "or-nav or-nav-open" : "or-nav"} aria-label="Main navigation">
        <a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href={platformHref("prices")} onClick={() => setMenuOpen(false)}>Market prices</a><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#for-whom" onClick={() => setMenuOpen(false)}>For everyone</a>
      </nav>
      <a className="or-header-cta" href={platformHref()}>Open the market <ArrowRight size={15} /></a>
    </header>

    <main>
      <section className="or-hero">
        <div className="or-hero-copy">
          <span className="or-eyebrow"><span /> A farm-to-home network with the chain in view</span>
          <h1>Food has a starting point.<br /><em>Keep it in sight.</em></h1>
          <p>Meet the people growing your food. See what was offered, how the price is made, and what happens between harvest and handoff.</p>
          <div className="or-hero-actions"><a href={platformHref()} className="or-button or-button-dark">Explore available harvests <ArrowRight size={16} /></a><a href="#how" className="or-link">See how the route works <ArrowDownRight size={15} /></a></div>
          <div className="or-hero-facts"><span><BadgeCheck size={16} /><b>Grower-agreed terms</b></span><span><Eye size={16} /><b>Price breakdowns</b></span><span><PackageCheck size={16} /><b>Recorded handoffs</b></span></div>
        </div>
        <div className="or-hero-visual" role="img" aria-label="Original illustration of a farmer, green fields and the path from harvest to a nearby home">
          <img src="/field-to-home.svg" alt="" />
          <div className="or-image-kicker"><span>FIELD NOTE 01</span><b>From this week's harvest</b><small>Grower · batch · route · home</small></div>
          <div className="or-image-stamp"><Leaf size={17} /><span>GROWN<br />NEARBY</span></div>
          <span className="or-image-caption">A closer food system starts with a real relationship.</span>
        </div>
        <a className="or-scroll-hint" href="#why"><span>Scroll to see the difference</span><ChevronDown size={15} /></a>
      </section>

      <section className="or-thesis" id="why"><div className="or-thesis-inner"><span className="or-index">THE IDEA</span><h2>When the only buyer at harvest is the local trader, a farmer may have to sell before the price feels fair.</h2><p>OriginalRoot gives growers another route to nearby households—while keeping storage, grading, packing and delivery visible as real work with real costs.</p><a href="#how">See what changes <ArrowRight size={14} /></a></div><div className="or-thesis-note"><span className="or-note-symbol"><HandCoins size={20} /></span><b>Fair access is built in the open.</b><small>We don’t rely on hiding costs or creating artificial scarcity. Availability and timing follow the harvest and the capacity to handle it well.</small></div></section>

      <section className="or-services" id="services"><div className="or-section-head"><div><span className="or-eyebrow"><span /> The OriginalRoot platform</span><h2>Useful tools for the<br /><em>whole harvest route.</em></h2></div><p>One connected workspace for growing, buying, reviewing, and moving produce—with clear boundaries around every claim.</p></div><div className="or-service-grid">
        <article><span className="or-service-icon"><Sprout size={19} /></span><small>FOR GROWERS</small><h3>Sell a harvest</h3><p>Set the crop, quantity, harvest window, and minimum payout you will accept.</p><a href={platformHref("grower")}>Open grower workspace <ArrowRight size={14} /></a></article>
        <article><span className="or-service-icon"><BarChart3 size={19} /></span><small>DAILY REFERENCE</small><h3>Check mandi prices</h3><p>Compare official daily wholesale ranges by state and commodity.</p><a href={platformHref("prices")}>View market prices <ArrowRight size={14} /></a></article>
        <article><span className="or-service-icon"><ShoppingBasket size={19} /></span><small>FOR HOUSEHOLDS</small><h3>Buy direct harvests</h3><p>Browse reviewed local offers and request available quantities from growers.</p><a href={platformHref("shop")}>Browse the marketplace <ArrowRight size={14} /></a></article>
        <article><span className="or-service-icon"><PackageCheck size={19} /></span><small>ORIGIN & HANDLING</small><h3>Follow a batch record</h3><p>See recorded offer, grade, price split, handling, and delivery checkpoints.</p><a href={platformHref("shop")}>Explore farm records <ArrowRight size={14} /></a></article>
        <article><span className="or-service-icon"><ClipboardCheck size={19} /></span><small>FOR LOCAL TEAMS</small><h3>Coordinate orders</h3><p>Review harvest offers, confirm fulfilment, and record the handoff.</p><a href={platformHref("operator")}>Open local operations <ArrowRight size={14} /></a></article>
        <article><span className="or-service-icon"><ShieldCheck size={19} /></span><small>COMMUNITY PLANNING</small><h3>Pool household interest</h3><p>Anonymous neighborhood signals help growers see what families hope to buy.</p><a href={platformHref("shop", "demand")}>Share what you need <ArrowRight size={14} /></a></article>
      </div><p className="or-services-note">Some tools need the local OriginalRoot service and approved records. Market prices use the official daily source when a data.gov.in key is configured.</p></section>

      <section className="or-how" id="how"><div className="or-section-head"><div><span className="or-eyebrow"><span /> A clear path, step by step</span><h2>From offer to <em>front door.</em></h2></div><p>Technology keeps the record together. Growers and local teams still make the decisions and do the work.</p></div>
        <div className="or-how-grid"><div className="or-step-list" role="tablist" aria-label="Explore the harvest journey">{stories.map((item, index) => { const Icon = item.Icon; return <button key={item.eyebrow} role="tab" aria-selected={activeStory === index} className={activeStory === index ? "or-step active" : "or-step"} onClick={() => setActiveStory(index)}><span className="or-step-num">0{index + 1}</span><span className="or-step-icon"><Icon size={17} /></span><span className="or-step-title">{item.title}</span><ArrowRight className="or-step-arrow" size={15} /></button>; })}</div>
          <article className="or-story" role="tabpanel" key={story.eyebrow}><div className="or-story-top"><span>{story.eyebrow}</span><StoryIcon size={19} /></div><h3>{story.title}</h3><p>{story.copy}</p><div className="or-story-proof"><CircleCheck size={17} /><span>{story.proof}</span></div><div className="or-route-rail"><span>GROWER</span><i /><span>LOCAL TEAM</span><i /><span>HOUSEHOLD</span></div><a href={platformHref(activeStory === 0 ? "grower" : "shop")}>{activeStory === 0 ? "Open the grower workspace" : "Explore the marketplace"} <ArrowRight size={14} /></a></article>
        </div>
      </section>

      <section className="or-roles" id="for-whom"><div className="or-roles-heading"><span className="or-eyebrow"><span /> One connected platform</span><h2>Three people.<br /><em>One shared record.</em></h2><p>Each person gets a space shaped around what they need to do.</p></div><div className="or-role-grid">
        <article className="or-role-card or-role-grower"><span className="or-role-icon"><Sprout size={20} /></span><small>FOR GROWERS & COLLECTIVES</small><h3>Your harvest.<br />Your terms.</h3><p>Publish offers, set a minimum payout, add batch evidence, and follow every review.</p><a href={platformHref("grower")}>Enter grower space <ArrowRight size={14} /></a><span className="or-role-art or-art-field">01</span></article>
        <article className="or-role-card or-role-customer"><span className="or-role-icon"><Wheat size={20} /></span><small>FOR HOUSEHOLDS</small><h3>Know what<br />reaches your table.</h3><p>Browse reviewed harvests, read the price split, and follow a local order.</p><a href={platformHref("shop")}>Browse the market <ArrowRight size={14} /></a><span className="or-role-art or-art-basket">02</span></article>
        <article className="or-role-card or-role-operator"><span className="or-role-icon"><MapPin size={20} /></span><small>FOR LOCAL OPERATORS</small><h3>Make the handoff<br />work in real life.</h3><p>Review offers, coordinate pickup or delivery, and keep the record current.</p><a href={platformHref("operator")}>Open operations <ArrowRight size={14} /></a><span className="or-role-art or-art-route">03</span></article>
      </div></section>

      <section className="or-standards"><div className="or-standard-mark"><span>OR</span><i /><span>FIELD TO HOME</span></div><div><span className="or-eyebrow">A promise with boundaries</span><h2>Clear records. Honest labels. No made-up claims.</h2><p>A local operator’s review is a record—not independent certification. A harvest is only shown as available when an approved offer exists. Payments and delivery still depend on the local team.</p></div><a href={platformHref()}>See what's available <ArrowRight size={15} /></a></section>
    </main>

    <footer className="or-footer"><div className="or-footer-main"><div><BrandLogo /><p>A more direct route for food—and a clearer view of how it gets there.</p></div><div className="or-footer-links"><a href="#why">Why OriginalRoot</a><a href="#how">How it works</a><a href={platformHref("grower")}>Grower workspace</a><a href={platformHref()}>Customer marketplace</a><a href={platformHref("operator")}>Local operations</a></div><div className="or-footer-place"><span><i /> LOCAL-FIRST NETWORK</span><b>Mysuru · Mandya · Srirangapatna</b><small>Market availability depends on reviewed local offers.</small></div></div><div className="or-footer-bottom"><span>© 2026 OriginalRoot</span><span>Built around the people who grow and the people who eat.</span></div></footer>
  </div>;
}
