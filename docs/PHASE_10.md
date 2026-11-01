# OriginalRoot Phase 10: pilot operations and data safety

## Goal

Make local pilot data recoverable and let the workspace owner remove or restore an operator's access without editing SQLite by hand.

## Included

- The owner can suspend or reactivate an operator account. Suspension revokes all sessions immediately; a reactivated operator must sign in again. Owner accounts cannot be suspended through this workflow.
- The database uses an additive `is_active` migration. Existing operator accounts remain active after upgrade.
- `api/backup.py` creates a consistent SQLite backup, includes the evidence image files, writes a SHA-256 manifest, verifies the bundle, and checks SQLite integrity.
- Restore validates the archive before changing data and creates a verified safety copy of the current database and evidence first. It requires an explicit `--confirm` flag and must be run with the OriginalRoot service stopped.
- `docs/PILOT_RUNBOOK.md` defines the operating checklist and a controlled first corridor workflow.

## Back up the local Docker data

Run from the repository root in PowerShell:

```powershell
docker compose exec -T OriginalRoot python api/backup.py create
docker compose exec -T OriginalRoot python api/backup.py verify /data/backups/NAME-RETURNED-BY-CREATE.tar.gz
New-Item -ItemType Directory -Force .\OriginalRoot-backups
docker compose cp OriginalRoot:/data/backups/NAME-RETURNED-BY-CREATE.tar.gz .\OriginalRoot-backups\
```

Run backup after the current upload and review activity has settled. If a grower is uploading or an operator is changing evidence while the bundle is being captured, the tool detects a database/file mismatch and asks you to retry.

The archive contains customer contact and delivery data, grower account data, and uploaded evidence. Store any copy outside the Docker volume in an encrypted, access-controlled location. A backup kept only inside the `OriginalRoot-data` volume will not survive loss of that volume or its host.

## Restore a backup

First copy the intended archive into the running container, verify it, and stop the service:

```powershell
docker compose cp .\OriginalRoot-backups\YOUR-BACKUP.tar.gz OriginalRoot:/data/restore.tar.gz
docker compose exec -T OriginalRoot python api/backup.py verify /data/restore.tar.gz
docker compose stop OriginalRoot
```

Then run the destructive restore command and restart the service:

```powershell
docker compose run --rm --no-deps --entrypoint python OriginalRoot api/backup.py restore /data/restore.tar.gz --confirm
docker compose up -d OriginalRoot
docker compose ps
```

Restore replaces the SQLite database and the evidence directory with the selected backup. The tool first saves the current state under `/data/backups` and reports that safety-copy path. Copy important backups out of the Docker volume, and only restore an archive whose source you trust.

## Pilot operating checklist

See [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md) for owner setup, onboarding, batch review, evidence review, fulfilment, complaint handling, backup cadence, and the measures to record during a small invited trial.

## Limits

Backups are manual; no scheduler, remote storage, or encryption is built into OriginalRoot. The owner must protect copied archives and perform restore operations deliberately. Operator suspension controls staff accounts; the owner recovery procedure remains manual. This phase does not make the app safe for internet deployment, add payments, or establish that farm or batch claims are true. Keep the local app on loopback and use consented pilot data only.
