# OriginalRoot

OriginalRoot is a local-first prototype for a farmer-led produce network. It combines a customer shop with batch traceability and a grower workspace. The product goal is to make produce origin, quality decisions, price components, and demo-order records easier to understand.

## Current status

This is a **prototype, not a live marketplace**. All farmers, farms, batches, harvest details, grades, stock, prices, and grower-dashboard figures are fictional examples. The app does not verify farms or food safety, contact farmers, reserve produce, collect payments, or arrange delivery. Do not enter real customer, farmer, address, bank, or payment information.

The demo checkout creates a non-personal order record in a local SQLite database when the API is running. It never collects money or reserves stock. If the API is unavailable, it records the demo reference in the current browser only. Grower listing drafts are not sent to the server.

## What works

- Browse, search, and filter the sample harvest.
- Open a sample Farm Passport with batch and handling details.
- Add produce to a basket and inspect the illustrative price breakdown.
- Record a demo checkout; the server validates product IDs and quantities and calculates totals from the shared catalog.
- Look up a demo order by its reference through the local API.
- Switch to a grower workspace and save a harvest-listing draft in the browser.
- Run the combined static site and demo API locally with Docker Compose.

## Run locally

Run these commands from the OriginalRoot project root (`frontend/OriginalRoot` in the original workspace):

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

### Run the production build locally

```powershell
pnpm build
python api/server.py
```

Then open `http://127.0.0.1:8080`.

### Run with Docker

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8080`. Demo-order records are stored in a Docker volume. The published container port is bound to loopback for local use.

## Local API

- `GET /api/health` reports local demo mode and confirms payments are disabled.
- `GET /api/products` returns the same sample catalog used by the web app.
- `POST /api/demo/orders` records a non-personal demo order. The request body contains only product IDs and quantities.
- `GET /api/demo/orders/{reference}` retrieves that demo order and its price breakdown.

The API binds to `127.0.0.1` by default. It has no login, farmer identity checks, production inventory, payment integration, or public deployment hardening. Do not expose it to the internet or use it for real orders.

## Product decisions

- Start with a responsive web app; validate one local supply corridor before native apps or multi-city operations.
- Treat the physical operation as part of the product: farmer onboarding, collection, grading, packing, fulfilment, and complaint handling.
- Show farmer proceeds, packing, platform coordination, and route cost separately.
- Treat storage as optional and crop-specific; do not base the model on deliberately creating scarcity.
- A QR code points to records; it does not independently prove the records are true.
- Add verified accounts, real inventory, payment integrations, and production hosting only after operational, legal, and security review.

## Before a real pilot

Replace sample data with field-verified records; add authenticated farmer, customer, operator, and administrator roles; establish grade and rejection standards with evidence and appeals; add secure payment-provider integration; define food-safety, privacy, complaint, refund, retention, and backup procedures; and review applicable state and food-business requirements. Test the real unit economics in one crop corridor before expanding.

## Technology

- React, TypeScript, Vite, and Lucide icons
- Python standard-library HTTP server for the local demo API
- SQLite for local demo-order persistence
- Docker Compose for a one-command local package

## License

OriginalRoot's original project code is released under the MIT License. Third-party dependencies retain their own licenses.
