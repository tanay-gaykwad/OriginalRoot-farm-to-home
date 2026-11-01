# OriginalRoot Phase 3: pickup requests and order tracking

## Goal

Let a customer request an approved harvest for pickup, reserve only available quantity, and follow the request through operator confirmation. This tests the order and handoff loop before taking payments or promising home delivery.

## Included

- Customer selects a published offer, quantity, name, and mobile number for pickup coordination.
- The order price is locked from the approved offer and its price components at request time.
- SQLite `BEGIN IMMEDIATE` makes the availability check and reservation atomic to prevent overselling.
- Operator queue supports `requested → accepted → ready for pickup → completed`; an operator may cancel before completion.
- Cancellation releases the held quantity. Order events preserve the status and operator note history.
- Customer tracking by a random order reference returns status and pickup note only; it never returns the customer's phone number.
- No online payment, refund, or delivery integration is enabled.

## Local setup

Set `OriginalRoot_OPERATOR_TOKEN` before starting the API (see [Phase 2 setup](PHASE_2.md)). Then run the Vite site and API locally. Order requests are disabled unless the operator key is configured. The local API is bound to loopback by default; order contact details are written to the local SQLite database and must be handled as private data.

## Hosted site boundary

GitHub Pages cannot run the SQLite API. It therefore disables order requests and never sends the checkout form. Do not expose the local API to the public internet. Before a public pilot, move to a secured HTTPS backend with authenticated roles, rate limits, encrypted backups, retention/deletion controls, a privacy notice, and a tested support process for customer data.

## Acceptance criteria

- Only published harvests can receive requests.
- A request must match the offer's pickup community and have valid quantity and mobile number.
- Concurrent requests cannot reserve more than the approved offer quantity.
- The order price and price split are locked at request time.
- Customer tracking returns no contact data; only an operator-key authenticated queue can read customer contact details.
- Operator transitions outside the stated order lifecycle are rejected.
- Cancellation returns the quantity to the offer's remaining balance.
- No payment is taken and no home delivery is promised.

