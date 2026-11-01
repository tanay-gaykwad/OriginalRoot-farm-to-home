# OriginalRoot Phase 7: local delivery and handoff

## Goal

Extend the database-backed pickup flow to support local delivery in the same pilot communities. Give customers a clear status trail and require a customer handoff code before an operator can mark a delivery complete.

## Included

- Customers can request local delivery or pickup for a published harvest.
- Delivery requests require an address; pickup requests do not store one.
- Addresses are returned only in the signed-in operator queue. Public order tracking exposes status, fulfilment method, and status notes, but no name, phone, or address.
- Delivery orders follow `requested → accepted → ready_for_delivery → out_for_delivery → delivered`. Operators can record `delivery_failed`, retry it, or cancel it before successful delivery.
- A random six-digit customer handoff code is returned once when the request is created. Only its SHA-256 digest is stored. The operator must provide the matching code to mark the order delivered.
- Pickup orders retain their existing lifecycle and status transitions.
- Existing SQLite databases are upgraded in place with additive columns; older pickup orders default to pickup.
- Order changes remain attributed to the signed-in operator in the local audit history.

## Local workflow

1. Sign in as an operator and publish a reviewed grower offer.
2. In the customer view, choose **Order or pick up**, enter the requested details, and select local delivery or pickup.
3. For delivery, save the one-time handoff code shown after the request is recorded.
4. In Operations, accept the request, prepare and dispatch it, then verify the code the customer presents at handoff.
5. The customer can track the order by its reference. Tracking does not reveal contact details or the delivery address.

## Limits

This is a local, operator-managed delivery workflow. It does not assign drivers, plan routes, collect GPS, send SMS/WhatsApp notifications, collect payment, calculate live delivery prices, or provide a customer support channel. The local API stores delivery addresses in SQLite; keep it on loopback and protect the database volume. A public pilot needs authenticated driver accounts, transport and food-handling procedures, privacy/retention controls, HTTPS, rate limiting, backups, and a monitored service.
