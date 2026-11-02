import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import productCatalog from "./catalog.json";

type MandiRecord = {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
  arrivals?: string | number;
};

type PriceResponse = {
  records?: MandiRecord[];
  count?: number;
  total?: number;
  source?: string;
  fetched_at?: string;
  configured?: boolean;
  detail?: string;
};

const money = (value: string | number | undefined) => {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `₹${new Intl.NumberFormat("en-IN").format(parsed)}` : "—";
};

export function MarketPrices() {
  const [state, setState] = useState("Karnataka");
  const [commodityInput, setCommodityInput] = useState("");
  const [commodity, setCommodity] = useState("");
  const [records, setRecords] = useState<MandiRecord[]>([]);
  const [fetchedAt, setFetchedAt] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (commodity) params.set("commodity", commodity);
    try {
      const response = await fetch(`/api/market-prices?${params.toString()}`);
      const result = await response.json() as PriceResponse;
      setConfigured(result.configured !== false);
      if (!response.ok) throw new Error(result.detail || "Could not load official mandi prices.");
      setRecords(result.records || []);
      setFetchedAt(result.fetched_at || "");
    } catch (caught) {
      setRecords([]);
      setError(caught instanceof Error ? caught.message : "Could not connect to the market price service.");
    } finally {
      setLoading(false);
    }
  }, [state, commodity]);

  useEffect(() => { void loadPrices(); }, [loadPrices]);

  function searchCommodity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommodity(commodityInput.trim());
  }

  return <section className="market-prices-workspace">
    <div className="market-price-intro">
      <div>
        <span className="eyebrow"><span className="eyebrow-line" /> DAILY WHOLESALE REFERENCE</span>
        <h2>Mandi prices, in the open.</h2>
        <p>Compare official minimum, modal, and maximum wholesale prices before setting your offer. These are mandi references, not a guaranteed farm-gate price.</p>
      </div>
      <a href="https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi" target="_blank" rel="noreferrer">Data source <ExternalLink size={14} /></a>
    </div>

    <form className="market-price-filters" onSubmit={searchCommodity}>
      <label>State<select value={state} onChange={(event) => setState(event.target.value)}><option value="">All states &amp; UTs</option><option>Karnataka</option><option>Maharashtra</option><option>Andhra Pradesh</option><option>Telangana</option><option>Tamil Nadu</option><option>Kerala</option><option>Uttar Pradesh</option><option>Madhya Pradesh</option><option>Rajasthan</option><option>Gujarat</option><option>Punjab</option><option>Haryana</option><option>Bihar</option><option>Odisha</option><option>Chhattisgarh</option><option>Jharkhand</option><option>West Bengal</option><option>Assam</option><option>Arunachal Pradesh</option><option>Manipur</option><option>Meghalaya</option><option>Mizoram</option><option>Nagaland</option><option>Sikkim</option><option>Tripura</option><option>Goa</option><option>Himachal Pradesh</option><option>Uttarakhand</option><option>Jammu and Kashmir</option><option>Ladakh</option><option>Delhi</option></select></label>
      <label className="market-commodity-search">Commodity<input value={commodityInput} onChange={(event) => setCommodityInput(event.target.value)} maxLength={80} placeholder="e.g. wheat, tomato, tur" /></label>
      <button className="button button-dark" type="submit"><Search size={15} /> Apply filters</button>
      <button className="market-refresh" type="button" onClick={() => void loadPrices()} disabled={loading} aria-label="Refresh mandi prices"><RefreshCw size={16} className={loading ? "market-spin" : ""} /></button>
    </form>

    {error && <div className="market-price-error" role="status"><b>{configured ? "Market data unavailable" : "Connect the official data source"}</b><span>{error}</span>{!configured && <small>Add the key as <code>OriginalRoot_DATA_GOV_IN_API_KEY</code> to the local <code>.env</code> file, then restart the app. It stays on the server and is never sent to the browser.</small>}</div>}
    <div className="market-price-table-wrap">
      <table className="market-price-table"><thead><tr><th>Commodity</th><th>Mandi</th><th>District / state</th><th>Min (₹)</th><th>Modal (₹)</th><th>Max (₹)</th><th>Arrival date</th></tr></thead><tbody>
        {records.map((record, index) => <tr key={`${record.market}-${record.commodity}-${record.arrival_date}-${index}`}><td><b>{record.commodity || "—"}</b><small>{[record.variety, record.grade].filter(Boolean).join(" · ")}</small></td><td>{record.market || "—"}</td><td>{[record.district, record.state].filter(Boolean).join(", ") || "—"}</td><td>{money(record.min_price)}</td><td className="market-modal-price">{money(record.modal_price)}</td><td>{money(record.max_price)}</td><td>{record.arrival_date || "—"}</td></tr>)}
        {!loading && records.length === 0 && !error && <tr><td colSpan={7} className="market-no-results">No mandi records match these filters.</td></tr>}
      </tbody></table>
      {loading && <div className="market-table-loading"><RefreshCw size={16} className="market-spin" /> Loading official records…</div>}
    </div>
    <div className="market-price-footnote"><span><ShieldCheck size={14} /> Government mandi data · daily reporting</span><span>{fetchedAt ? `Fetched ${new Date(fetchedAt).toLocaleString("en-IN")}` : "Prices are shown in the units published by the source"}</span><small>Actual prices vary by grade, lot size, transport, and transaction date. Confirm conditions with the mandi before making a sale decision.</small></div>
  </section>;
}

type DemandGroup = { product_id: string; community: string; quantity: number; signals: number };

export function CommunityDemand() {
  const [groups, setGroups] = useState<DemandGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDemand = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/harvest-demand");
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Could not load household interest signals.");
      setGroups(Array.isArray(result.signals) ? result.signals : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect to community planning.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDemand(); }, [loadDemand]);

  const sortedGroups = [...groups].sort((left, right) => right.quantity - left.quantity || right.signals - left.signals);

  return <section className="community-demand-workspace">
    <div className="market-price-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> NEIGHBOURHOOD HARVEST PLANNING</span><h2>What households are asking for.</h2><p>Anonymous interest is grouped by produce and community to help local growers spot demand worth exploring.</p></div><button className="market-refresh" type="button" onClick={() => void loadDemand()} disabled={loading} aria-label="Refresh household interest"><RefreshCw size={16} className={loading ? "market-spin" : ""} /></button></div>
    <div className="demand-integrity-note"><ShieldCheck size={15} /><span>Signals are pooled household interest—not orders, guaranteed purchases, or a reason to create artificial scarcity.</span></div>
    {error && <div className="market-price-error" role="status"><b>Shared demand is unavailable</b><span>{error}</span></div>}
    {loading ? <div className="market-table-loading"><RefreshCw size={16} className="market-spin" /> Loading aggregate signals…</div> : !error && sortedGroups.length === 0 ? <div className="demand-empty"><b>No household interest signals yet</b><span>When households share what they would buy, anonymous totals will appear here.</span></div> : <div className="demand-signal-grid">{sortedGroups.map((group) => {
      const product = productCatalog.find((item) => item.id === group.product_id);
      return <article key={`${group.product_id}-${group.community}`}><span className="demand-signal-icon">{product?.emoji || "🌾"}</span><div><small>{group.community}</small><h3>{product?.name || group.product_id}</h3></div><b>{group.quantity}<small>household units</small></b><p>{group.signals} anonymous {group.signals === 1 ? "signal" : "signals"}</p></article>;
    })}</div>}
  </section>;
}
