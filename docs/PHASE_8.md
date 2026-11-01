# OriginalRoot Phase 8: customer and grower support

## Goal

Give customers and growers a trackable way to raise order or account concerns, and give operators one queue to investigate and record an outcome.

## Included

- Customers can submit an issue against an existing order after matching its order reference and checkout phone number.
- Customers can look up a ticket using its ID and the same phone number. Ticket details and status history are returned only after that match.
- Signed-in growers can raise general grievances or link a concern to one of their own harvest offers. Growers can only view their own tickets.
- Signed-in operators can see the support queue, the related order or harvest, customer contact details where relevant, status history, and record an update or resolution.
- Status changes follow a defined transition map and are appended to the ticket timeline and operator audit history.
- Existing SQLite installations receive the new support tables additively.

## Local workflow

1. Create the first owner account and sign in to enable order requests.
2. Customers request an order and use its reference to track it; the support form appears with the order record. They submit the phone number used at checkout.
3. Growers sign in to their account and use **Farmer support and grievances**.
4. An operator signs in, reviews the **Support queue**, changes the status, and writes a customer-facing note. Marking a ticket resolved stores the resolution note and preserves the full timeline.

## API routes

- `POST /api/support/customer-tickets`
- `POST /api/support/customer-ticket-status`
- `GET|POST /api/grower/support-tickets`
- `GET /api/operator/support-tickets`
- `POST /api/operator/support-tickets/{ticket_id}/status`

## Boundaries and next work

This phase records a request for refund or replacement review; it does not authorize, transfer, or refund money and does not fulfill a replacement. It has no image evidence upload, automated notifications, measured response SLA, moderation tools, or customer rating system. The operator queue currently shows ticket age, but does not promise a response time. Customer access relies on the order phone number as a shared secret, so a public service would need stronger identity checks, rate limiting, contact verification, retention controls, and an explicit support policy. Grower profiles remain self-asserted. The API should stay local until those controls and real operating procedures are in place.

The GitHub Pages build is a static preview and cannot submit or process support tickets; these workflows require the local Docker/API deployment.
