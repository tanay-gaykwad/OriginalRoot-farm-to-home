import { useState } from "react";
import { ArrowDownRight, ArrowRight, BadgeCheck, ChevronDown, CircleCheck, Eye, HandCoins, Leaf, MapPin, PackageCheck, Sprout, Truck, Wheat } from "lucide-react";

type Workspace = "shop" | "grower" | "customer" | "operator";

function platformHref(workspace: Workspace = "shop") {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ platform: "1", workspace }).toString();
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function BrandLogo() {
  return <a className="ks-brand" href="#top" aria-label="OriginalRoot home"><span className="ks-mark"><svg viewBox="0 0 38 38" aria-hidden="true"><path d="M8 28c8-1 16-7 21-18M10 18c5 1 9 5 10 10M19 12c3 1 6 4 7 8" /><circle cx="29" cy="9" r="2" /></svg></span><span>OriginalRoot<span className="ks-dot">.</span></span></a>;
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
  return <div className="ks-site" id="top">
    <div className="ks-topline"><span className="ks-live-mark" /> A shorter route from harvest to home <span className="ks-topline-note">Starting with Mysuru and nearby communities</span></div>
    <header className="ks-header">
      <BrandLogo />
      <button className="ks-menu-button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
      <nav className={menuOpen ? "ks-nav ks-nav-open" : "ks-nav"} aria-label="Main navigation">
        <a href="#why" onClick={() => setMenuOpen(false)}>Why this exists</a><a href="#how" onClick={() => setMenuOpen(false)}>How it works</a><a href="#for-whom" onClick={() => setMenuOpen(false)}>For everyone</a>
      </nav>
      <a className="ks-header-cta" href={platformHref()}>Open the market <ArrowRight size={15} /></a>
    </header>

    <main>
      <section className="ks-hero">
        <div className="ks-hero-copy">
          <span className="ks-eyebrow"><span /> A farm-to-home network with the chain in view</span>
          <h1>Food has a starting point.<br /><em>Keep it in sight.</em></h1>
          <p>Meet the people growing your food. See what was offered, how the price is made, and what happens between harvest and handoff.</p>
          <div className="ks-hero-actions"><a href={platformHref()} className="ks-button ks-button-dark">Explore available harvests <ArrowRight size={16} /></a><a href="#how" className="ks-link">See how the route works <ArrowDownRight size={15} /></a></div>
          <div className="ks-hero-facts"><span><BadgeCheck size={16} /><b>Grower-agreed terms</b></span><span><Eye size={16} /><b>Price breakdowns</b></span><span><PackageCheck size={16} /><b>Recorded handoffs</b></span></div>
        </div>
        <div className="ks-hero-visual" role="img" aria-label="Original illustration of a farmer, green fields and the path from harvest to a nearby home">
          <img src="/field-to-home.svg" alt="" />
          <div className="ks-image-kicker"><span>FIELD NOTE 01</span><b>From this week's harvest</b><small>Grower · batch · route · home</small></div>
          <div className="ks-image-stamp"><Leaf size={17} /><span>GROWN<br />NEARBY</span></div>
          <span className="ks-image-caption">A closer food system starts with a real relationship.</span>
        </div>
        <a className="ks-scroll-hint" href="#why"><span>Scroll to see the difference</span><ChevronDown size={15} /></a>
      </section>

      <section className="ks-thesis" id="why"><div className="ks-thesis-inner"><span className="ks-index">THE IDEA</span><h2>When the only buyer at harvest is the local trader, a farmer may have to sell before the price feels fair.</h2><p>OriginalRoot gives growers another route to nearby households—while keeping storage, grading, packing and delivery visible as real work with real costs.</p><a href="#how">See what changes <ArrowRight size={14} /></a></div><div className="ks-thesis-note"><span className="ks-note-symbol"><HandCoins size={20} /></span><b>Fair access is built in the open.</b><small>We don’t rely on hiding costs or creating artificial scarcity. Availability and timing follow the harvest and the capacity to handle it well.</small></div></section>

      <section className="ks-how" id="how"><div className="ks-section-head"><div><span className="ks-eyebrow"><span /> A clear path, step by step</span><h2>From offer to <em>front door.</em></h2></div><p>Technology keeps the record together. Growers and local teams still make the decisions and do the work.</p></div>
        <div className="ks-how-grid"><div className="ks-step-list" role="tablist" aria-label="Explore the harvest journey">{stories.map((item, index) => { const Icon = item.Icon; return <button key={item.eyebrow} role="tab" aria-selected={activeStory === index} className={activeStory === index ? "ks-step active" : "ks-step"} onClick={() => setActiveStory(index)}><span className="ks-step-num">0{index + 1}</span><span className="ks-step-icon"><Icon size={17} /></span><span className="ks-step-title">{item.title}</span><ArrowRight className="ks-step-arrow" size={15} /></button>; })}</div>
          <article className="ks-story" role="tabpanel" key={story.eyebrow}><div className="ks-story-top"><span>{story.eyebrow}</span><StoryIcon size={19} /></div><h3>{story.title}</h3><p>{story.copy}</p><div className="ks-story-proof"><CircleCheck size={17} /><span>{story.proof}</span></div><div className="ks-route-rail"><span>GROWER</span><i /><span>LOCAL TEAM</span><i /><span>HOUSEHOLD</span></div><a href={platformHref(activeStory === 0 ? "grower" : "shop")}>{activeStory === 0 ? "Open the grower workspace" : "Explore the marketplace"} <ArrowRight size={14} /></a></article>
        </div>
      </section>

      <section className="ks-roles" id="for-whom"><div className="ks-roles-heading"><span className="ks-eyebrow"><span /> One connected platform</span><h2>Three people.<br /><em>One shared record.</em></h2><p>Each person gets a space shaped around what they need to do.</p></div><div className="ks-role-grid">
        <article className="ks-role-card ks-role-grower"><span className="ks-role-icon"><Sprout size={20} /></span><small>FOR GROWERS & COLLECTIVES</small><h3>Your harvest.<br />Your terms.</h3><p>Publish offers, set a minimum payout, add batch evidence, and follow every review.</p><a href={platformHref("grower")}>Enter grower space <ArrowRight size={14} /></a><span className="ks-role-art ks-art-field">01</span></article>
        <article className="ks-role-card ks-role-customer"><span className="ks-role-icon"><Wheat size={20} /></span><small>FOR HOUSEHOLDS</small><h3>Know what<br />reaches your table.</h3><p>Browse reviewed harvests, read the price split, and follow a local order.</p><a href={platformHref("shop")}>Browse the market <ArrowRight size={14} /></a><span className="ks-role-art ks-art-basket">02</span></article>
        <article className="ks-role-card ks-role-operator"><span className="ks-role-icon"><MapPin size={20} /></span><small>FOR LOCAL OPERATORS</small><h3>Make the handoff<br />work in real life.</h3><p>Review offers, coordinate pickup or delivery, and keep the record current.</p><a href={platformHref("operator")}>Open operations <ArrowRight size={14} /></a><span className="ks-role-art ks-art-route">03</span></article>
      </div></section>

      <section className="ks-standards"><div className="ks-standard-mark"><span>KS</span><i /><span>FIELD TO HOME</span></div><div><span className="ks-eyebrow">A promise with boundaries</span><h2>Clear records. Honest labels. No made-up claims.</h2><p>A local operator’s review is a record—not independent certification. A harvest is only shown as available when an approved offer exists. Payments and delivery still depend on the local team.</p></div><a href={platformHref()}>See what's available <ArrowRight size={15} /></a></section>
    </main>

    <footer className="ks-footer"><div className="ks-footer-main"><div><BrandLogo /><p>A more direct route for food—and a clearer view of how it gets there.</p></div><div className="ks-footer-links"><a href="#why">Why OriginalRoot</a><a href="#how">How it works</a><a href={platformHref("grower")}>Grower workspace</a><a href={platformHref()}>Customer marketplace</a><a href={platformHref("operator")}>Local operations</a></div><div className="ks-footer-place"><span><i /> LOCAL-FIRST NETWORK</span><b>Mysuru · Mandya · Srirangapatna</b><small>Market availability depends on reviewed local offers.</small></div></div><div className="ks-footer-bottom"><span>© 2026 OriginalRoot</span><span>Built around the people who grow and the people who eat.</span></div></footer>
  </div>;
}
