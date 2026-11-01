# OriginalRoot

OriginalRoot is an interactive preview of a farmer-led produce network. It brings together a customer shop, harvest traceability, transparent price breakdowns, and a grower workspace.

## Public preview

[OriginalRoot on GitHub Pages](https://tanay-gaykwad.github.io/originalroot-farm-to-home/)

The preview uses fictional farms, listings, harvest records, prices, and grower figures. It does not verify farms or food safety, contact farmers, reserve produce, process payments, or arrange delivery. There is no live marketplace service behind this site. Do not enter real customer, farmer, address, bank, or payment information.

## What you can explore

- Browse, search, and filter the example harvest.
- Open a sample Farm Passport with batch and handling details.
- Add produce to a basket and inspect an illustrative price breakdown.
- Record a non-personal sample order locally; the API validates product IDs and quantities and calculates totals from the shared catalog.
- Look up a sample order reference through the local API.
- Switch to the grower workspace and save a harvest-listing draft in the browser.
- Run the combined static site and local order API with Docker Compose.
- Submit an anonymous crop-demand signal for a nearby community. With the local API, only aggregate counts by crop and community are exposed; on GitHub Pages the signal stays in the visitor's browser.

## Phase 1 product direction

OriginalRoot starts as a demand-led harvest network for one local corridor. Its first differentiator is helping growers plan from neighborhood demand while keeping growers in control of the minimum net payout and offer terms. Each batch should carry clear origin, grading, handling, and price-split records. Read the [Phase 1 product and operating plan](docs/PHASE_1.md) for scope, release gates, and success measures.

## Run locally

Run these commands from the project root:

```powershell
pnpm install --frozen-lockfile
```

Start the local API in one terminal:

```powershell
python api/server.py
```

Start the web app in another terminal:

```powershell
pnpm dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the local API on port 8080.

### Build and serve locally

```powershell
pnpm build
python api/server.py
```

Then open `http://127.0.0.1:8080`.

### Run with Docker

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8080`. Sample order records are stored in a Docker volume. The published container port is bound to loopback for local use.

## Local API

- `GET /api/health` reports local preview mode and confirms that payments are disabled.
- `GET /api/products` returns the same example catalog used by the web app.
- `POST /api/harvest-demand` accepts a crop, supported community, and household quantity without collecting personal details.
- `GET /api/harvest-demand` returns aggregate quantity and signal counts by crop and community, never individual signal records.
- `POST /api/demo/orders` records a non-personal sample order. The request body contains only product IDs and quantities.
- `GET /api/demo/orders/{reference}` retrieves that sample order and its price breakdown.

The API binds to `127.0.0.1` by default. It has no login, farmer identity checks, production inventory, payment integration, or public deployment hardening. Do not expose it to the internet or use it for real orders. The GitHub Pages site hosts the frontend only and does not connect to this local API.

## Product direction

- Start with a responsive web app and validate one local supply corridor before native apps or multi-city operations.
- Treat the physical operation as part of the product: farmer onboarding, collection, grading, packing, fulfilment, and complaint handling.
- Show farmer proceeds, packing, platform coordination, and route cost separately.
- Treat storage as optional and crop-specific; do not base the model on deliberately creating scarcity.
- A QR code points to records; it does not independently prove the records are true.
- Add verified accounts, real inventory, payment integrations, and production hosting only after operational, legal, and security review.

## Before a live pilot

Replace sample data with field-verified records; add authenticated farmer, customer, operator, and administrator roles; establish grade and rejection standards with evidence and appeals; add secure payment-provider integration; define food-safety, privacy, complaint, refund, retention, and backup procedures; and review applicable state and food-business requirements. Validate the real unit economics in one crop corridor before expanding.

## Technology

- React, TypeScript, Vite, and Lucide icons
- Python standard-library HTTP server for the local order API
- SQLite for local sample-order persistence
- Docker Compose for a one-command local package

## License

OriginalRoot's original project code is released under the MIT License. Third-party dependencies retain their own licenses.

