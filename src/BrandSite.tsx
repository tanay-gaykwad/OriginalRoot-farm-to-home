import { ArrowRight, BadgeCheck, Leaf, MapPin, ShieldCheck, Sprout, WalletCards, Wheat } from "lucide-react";

function platformHref(workspace: "shop" | "grower" | "operator" = "shop") {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ platform: "1", workspace }).toString();
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function BrandLogo() {
  return <a className="brand" href="#top" aria-label="OriginalRoot home"><span className="brand-symbol"><Leaf size={19} strokeWidth={2.4} /></span><span className="brand-name">OriginalRoot<span>.</span></span></a>;
}

export function BrandSite() {
  return <div className="brand-site" id="top">
    <div className="brand-topline"><span className="fresh-dot" /> A more visible path from farm to home <span>·</span> Built around local harvests</div>
    <header className="brand-header wrap">
      <BrandLogo />
      <nav aria-label="Main navigation"><a href="#approach">Our approach</a><a href="#growers">For growers</a><a href="#customers">For customers</a></nav>
      <a className="button button-dark" href={platformHref()}>Explore OriginalRoot <ArrowRight size={15} /></a>
    </header>

    <main>
      <section className="brand-hero wrap">
        <div className="brand-hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> A farmer-to-home network</span>
          <h1>Let food travel<br />with its <em>story.</em></h1>
          <p>OriginalRoot connects growers and nearby households through clear harvest offers, agreed prices, batch records, and local fulfilment.</p>
          <div className="brand-hero-actions"><a className="button button-dark" href={platformHref()}>Enter the platform <ArrowRight size={16} /></a><a className="text-button" href={platformHref("grower")}>I grow food <ArrowRight size={15} /></a></div>
          <div className="brand-promise"><ShieldCheck size={17} /><span><b>Clear records at every step</b><small>Grower terms, batch updates, and price breakdowns stay visible.</small></span></div>
        </div>
        <div className="brand-hero-art" aria-label="Illustration of a local farm landscape" role="img">
          <span className="brand-art-sun" /><span className="brand-art-hill brand-art-hill-back" /><span className="brand-art-hill brand-art-hill-front" />
          <span className="brand-art-row brand-art-row-one" /><span className="brand-art-row brand-art-row-two" /><span className="brand-art-row brand-art-row-three" />
          <span className="brand-art-produce">🌿</span>
          <span className="brand-art-note"><MapPin size={14} /><span><b>Start with one local corridor</b><small>Grow at the pace the harvest can support</small></span></span>
          <span className="brand-art-stamp"><Leaf size={20} /><b>FROM<br />THE FARM</b></span>
        </div>
      </section>

      <section className="brand-principles" id="approach"><div className="wrap brand-principle-grid">
        <article><span><Sprout size={18} /></span><div><b>Growers set the offer</b><p>Quantity, harvest timing, grade notes, and minimum payout are agreed before an offer is published.</p></div></article>
        <article><span><WalletCards size={18} /></span><div><b>Prices have a breakdown</b><p>Show the grower share alongside packing, local handling, and delivery costs.</p></div></article>
        <article><span><BadgeCheck size={18} /></span><div><b>Batches carry records</b><p>Keep origin and handling updates with each batch, and show who entered each record.</p></div></article>
      </div></section>

      <section className="brand-roles wrap">
        <div className="brand-section-heading"><span className="eyebrow"><span className="eyebrow-line" /> One network, clear roles</span><h2>Useful from the field<br />to the <em>front door.</em></h2><p>OriginalRoot brings the coordination work into one shared place, while growers keep control of what they offer.</p></div>
        <div className="brand-role-cards">
          <article id="growers"><span className="brand-role-icon"><Sprout size={19} /></span><small>GROWERS & COLLECTIVES</small><h3>Plan and publish a harvest.</h3><p>Set offer terms, submit batch evidence, and follow review and order updates.</p><a href={platformHref("grower")}>Open grower workspace <ArrowRight size={14} /></a></article>
          <article id="customers"><span className="brand-role-icon"><Wheat size={19} /></span><small>NEARBY HOUSEHOLDS</small><h3>Choose with more context.</h3><p>Explore available produce, see the price split, and follow a batch from offer to handoff.</p><a href={platformHref()}>Explore the marketplace <ArrowRight size={14} /></a></article>
          <article><span className="brand-role-icon"><ShieldCheck size={19} /></span><small>LOCAL OPERATORS</small><h3>Coordinate the handoffs.</h3><p>Review offers, record checkpoints, manage delivery, and respond to support requests.</p><a href={platformHref("operator")}>Open operations <ArrowRight size={14} /></a></article>
        </div>
      </section>

      <section className="brand-categories"><div className="wrap brand-category-inner"><div><span className="eyebrow"><span className="eyebrow-line" /> A practical place to start</span><h2>Fresh today.<br /><em>Staples next.</em></h2></div><p>Start with the crops a local route can reliably handle. Extend the catalog to grains, pulses, and other staples as farmer supply, grading, storage, and demand are ready.</p><a className="button button-dark" href={platformHref()}>See the current platform <ArrowRight size={15} /></a></div></section>
    </main>

    <footer className="brand-footer wrap"><BrandLogo /><p>Clear records. Fair terms. A closer connection between the people who grow food and the people who eat it.</p><small>OriginalRoot is being built for a controlled local rollout. Public customer orders, payments, and delivery depend on the local operating team and configured services.</small><span>© 2026 OriginalRoot</span></footer>
  </div>;
}
