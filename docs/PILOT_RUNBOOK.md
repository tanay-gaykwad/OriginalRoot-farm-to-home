# OriginalRoot local pilot runbook

This guide is for a small, invited, operator-managed trial on the local Docker installation. It is not a public launch procedure. GitHub Pages is a static preview; its data is not shared with the local app.

## Before inviting participants

- Confirm the Docker service is healthy at `http://127.0.0.1:8080` and remains bound to loopback.
- Create the owner account with the bootstrap key from `.env`; store the owner credentials securely.
- Create individual operator accounts only for people who need to review offers, evidence, orders, and support tickets.
- Create and verify a database-plus-evidence backup, then copy it to encrypted storage outside the Docker volume.
- Explain to each grower what information is stored, how their offer and approved evidence may appear publicly, and how to contact the operator with a concern.
- Choose one short route and a small number of crops that growers can reliably supply. Set a harvest window, collection point, grade notes, cutoff, and a realistic fulfilment capacity.
- Tell invited customers that OriginalRoot does not collect payment. Agree how any off-platform arrangements will be communicated and recorded before taking real orders.

## Per harvest cycle

1. A grower creates an account, submits an offer, and attaches only relevant batch photos. Ask them to remove location metadata and avoid identity documents or private customer information.
2. An operator checks the offer terms with the grower, records observed quantity and grade, and publishes only the agreed offer.
3. The operator reviews each evidence image against its specific claim. Approve only material appropriate for public display; the passport explains that operator review is not certification.
4. Invite a small customer group to request only the quantity the team can fulfil. Make pickup or delivery arrangements clear before accepting requests.
5. Record each handoff, any shortfall, quality concern, and support outcome. Use OriginalRoot's support queue for customer complaints and grower grievances.
6. Compare the agreed grower minimum with the recorded payout terms, accepted quantity with delivered quantity, and the number and type of complaints. Record what did not work before expanding the next cycle.

## Backup cadence

- Create a bundle before the first real pilot record is entered.
- Create another verified bundle after each harvest cycle and before any restore, software migration, or host maintenance.
- Keep at least one recent copy outside the Docker volume in encrypted, access-controlled storage.
- Perform a restore rehearsal with a separate disposable installation before relying on a backup for recovery. Do not rehearse by overwriting the active pilot database.

## Pause and review

Pause new orders if the current quantity, grade, route capacity, or participant contact process cannot be confirmed. Pause evidence publication if an image contains private material or the operator cannot support the claim it accompanies. Resolve data loss or access concerns before continuing. Do not expand to another community until the first route's delivery, grower proceeds, complaints, and repeat interest are understood.
