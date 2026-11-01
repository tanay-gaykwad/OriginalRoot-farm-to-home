"""Create, verify, and restore local OriginalRoot data bundles."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tarfile
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path


DATA_PATH = Path(os.environ.get("OriginalRoot_DB_PATH", Path(__file__).resolve().parents[1] / ".data" / "OriginalRoot.sqlite3"))
DATA_DIR = DATA_PATH.parent
EVIDENCE_PATH = DATA_DIR / "evidence"
BACKUP_DIR = DATA_DIR / "backups"
MAX_EVIDENCE_BYTES = 2_000_000
MAX_DATABASE_BYTES = 2_000_000_000
EVIDENCE_NAME = re.compile(r"EVD-[0-9A-F]{16}\.(?:jpg|png|webp)\Z")
FORMAT_VERSION = "OriginalRoot-data-bundle-v1"
MEDIA_EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


class BackupError(Exception):
    """An invalid or incomplete backup operation."""


def hash_stream(stream) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    while chunk := stream.read(1024 * 1024):
        size += len(chunk)
        digest.update(chunk)
    return size, digest.hexdigest()


def hash_file(path: Path) -> tuple[int, str]:
    with path.open("rb") as source:
        return hash_stream(source)


def database_integrity(path: Path) -> None:
    try:
        connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
        try:
            result = connection.execute("PRAGMA integrity_check").fetchone()
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise BackupError(f"Could not read the SQLite database: {exc}") from exc
    if result is None or result[0] != "ok":
        raise BackupError("SQLite integrity check failed")


def database_evidence_entries(path: Path) -> dict[str, tuple[int, str]]:
    connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    try:
        table = connection.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'harvest_evidence'").fetchone()
        if table is None:
            return {}
        rows = connection.execute("SELECT id, media_type, byte_size, sha256 FROM harvest_evidence").fetchall()
    except sqlite3.Error as exc:
        raise BackupError(f"Could not read evidence records from SQLite: {exc}") from exc
    finally:
        connection.close()
    entries = {}
    for evidence_id, media_type, byte_size, sha256 in rows:
        extension = MEDIA_EXTENSIONS.get(media_type)
        if not isinstance(evidence_id, str) or not re.fullmatch(r"EVD-[0-9A-F]{16}", evidence_id) or not extension:
            raise BackupError("Database contains an unsupported evidence record")
        if not isinstance(byte_size, int) or not 1 <= byte_size <= MAX_EVIDENCE_BYTES or not isinstance(sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", sha256):
            raise BackupError(f"Database contains invalid evidence metadata: {evidence_id}")
        name = f"{evidence_id}{extension}"
        if name in entries:
            raise BackupError(f"Database contains a duplicate evidence file reference: {name}")
        entries[name] = (byte_size, sha256)
    return entries


def evidence_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    if root.is_symlink() or not root.is_dir():
        raise BackupError("Evidence path must be a regular directory")
    files = []
    for path in root.iterdir():
        if path.is_symlink() or not path.is_file() or not EVIDENCE_NAME.fullmatch(path.name):
            raise BackupError(f"Unexpected entry in the evidence directory: {path.name}")
        if path.stat().st_size > MAX_EVIDENCE_BYTES:
            raise BackupError(f"Evidence file exceeds the upload limit: {path.name}")
        files.append(path)
    return sorted(files, key=lambda item: item.name)


def create_backup(output_dir: Path = BACKUP_DIR) -> Path:
    if not DATA_PATH.is_file():
        raise BackupError(f"OriginalRoot database not found at {DATA_PATH}")
    output_dir.mkdir(parents=True, exist_ok=True)
    if output_dir.resolve() == EVIDENCE_PATH.resolve():
        raise BackupError("Backup output cannot be the evidence directory")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_path = output_dir / f"OriginalRoot-backup-{stamp}-{uuid.uuid4().hex[:8]}.tar.gz"
    temp_archive = output_dir / f".{archive_path.name}.tmp"

    try:
        with tempfile.TemporaryDirectory(prefix="OriginalRoot-backup-") as temp_dir_name:
            temp_database = Path(temp_dir_name) / "OriginalRoot.sqlite3"
            source = sqlite3.connect(DATA_PATH, timeout=30)
            target = sqlite3.connect(temp_database)
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
            try:
                os.chmod(temp_database, 0o600)
            except OSError:
                pass
            database_integrity(temp_database)

            source_files = evidence_files(EVIDENCE_PATH)
            expected_evidence = database_evidence_entries(temp_database)
            observed_evidence = {item.name: hash_file(item) for item in source_files}
            if observed_evidence != expected_evidence:
                raise BackupError("Evidence files and database records do not match; retry when no upload or review is in progress")
            entries = [("OriginalRoot.sqlite3", temp_database)]
            entries.extend((f"evidence/{item.name}", item) for item in source_files)
            manifest_files = []
            for archive_name, source_path in entries:
                size, sha256 = hash_file(source_path)
                manifest_files.append({"path": archive_name, "size": size, "sha256": sha256})
            manifest = {
                "format": FORMAT_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "files": manifest_files,
            }
            with tarfile.open(temp_archive, mode="w:gz", compresslevel=6) as archive:
                for archive_name, source_path in entries:
                    archive.add(source_path, arcname=archive_name, recursive=False)
                payload = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                info = tarfile.TarInfo("manifest.json")
                info.size = len(payload)
                info.mode = 0o600
                archive.addfile(info, io.BytesIO(payload))
        os.chmod(temp_archive, 0o600)
        os.replace(temp_archive, archive_path)
    except Exception:
        temp_archive.unlink(missing_ok=True)
        raise
    return archive_path


def _read_and_verify_to_database(archive_path: Path, database_output: Path) -> tuple[dict, int]:
    try:
        archive = tarfile.open(archive_path, mode="r:gz")
    except (OSError, tarfile.TarError) as exc:
        raise BackupError(f"Could not open the backup archive: {exc}") from exc
    with archive:
        members = archive.getmembers()
        if len(members) > 50_002:
            raise BackupError("Backup contains too many files")
        by_name = {}
        for member in members:
            if not member.isfile() or member.name in by_name:
                raise BackupError("Backup contains a duplicate or unsupported archive entry")
            if member.name != "manifest.json" and member.name != "OriginalRoot.sqlite3" and not re.fullmatch(r"evidence/EVD-[0-9A-F]{16}\.(?:jpg|png|webp)", member.name):
                raise BackupError("Backup contains an unexpected file path")
            by_name[member.name] = member
        manifest_member = by_name.get("manifest.json")
        if manifest_member is None or manifest_member.size > 10_000_000:
            raise BackupError("Backup manifest is missing or too large")
        manifest_stream = archive.extractfile(manifest_member)
        if manifest_stream is None:
            raise BackupError("Backup manifest cannot be read")
        try:
            manifest = json.loads(manifest_stream.read().decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BackupError("Backup manifest is invalid") from exc
        if not isinstance(manifest, dict) or manifest.get("format") != FORMAT_VERSION or not isinstance(manifest.get("files"), list):
            raise BackupError("Backup format is not supported")
        expected = {"manifest.json"}
        database_seen = False
        for entry in manifest["files"]:
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                raise BackupError("Backup manifest has an invalid file entry")
            name = entry["path"]
            if name == "OriginalRoot.sqlite3":
                if database_seen:
                    raise BackupError("Backup manifest repeats the database")
                database_seen = True
                max_size = MAX_DATABASE_BYTES
            elif re.fullmatch(r"evidence/EVD-[0-9A-F]{16}\.(?:jpg|png|webp)", name):
                max_size = MAX_EVIDENCE_BYTES
            else:
                raise BackupError("Backup manifest contains an unsafe path")
            member = by_name.get(name)
            if member is None or name in expected or not isinstance(entry.get("size"), int) or entry["size"] < 0 or entry["size"] > max_size or member.size != entry["size"]:
                raise BackupError(f"Backup entry is missing or has an invalid size: {name}")
            if not isinstance(entry.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
                raise BackupError(f"Backup entry has an invalid checksum: {name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise BackupError(f"Backup entry cannot be read: {name}")
            size, digest = hash_stream(stream)
            if size != entry["size"] or digest != entry["sha256"]:
                raise BackupError(f"Backup checksum mismatch: {name}")
            expected.add(name)
            if name == "OriginalRoot.sqlite3":
                database_output.parent.mkdir(parents=True, exist_ok=True)
                stream = archive.extractfile(member)
                if stream is None:
                    raise BackupError("Backup database cannot be read")
                with database_output.open("wb") as destination:
                    shutil.copyfileobj(stream, destination)
                try:
                    os.chmod(database_output, 0o600)
                except OSError:
                    pass
        if not database_seen or set(by_name) != expected:
            raise BackupError("Backup file list does not match its manifest")
    database_integrity(database_output)
    archived_evidence = {
        Path(entry["path"]).name: (entry["size"], entry["sha256"])
        for entry in manifest["files"]
        if entry["path"].startswith("evidence/")
    }
    if database_evidence_entries(database_output) != archived_evidence:
        raise BackupError("Backup evidence files do not match the database records")
    return manifest, len(expected) - 2


def read_and_verify(archive_path: Path, database_output: Path | None = None) -> tuple[dict, int]:
    if database_output is not None:
        return _read_and_verify_to_database(archive_path, database_output)
    with tempfile.TemporaryDirectory(prefix="OriginalRoot-verify-") as temp_dir_name:
        return _read_and_verify_to_database(archive_path, Path(temp_dir_name) / "OriginalRoot.sqlite3")


def stage_archive(archive_path: Path, stage: Path) -> int:
    stage.mkdir(parents=True, exist_ok=True)
    manifest, evidence_count = read_and_verify(archive_path, stage / "OriginalRoot.sqlite3")
    staged_evidence = stage / "evidence"
    staged_evidence.mkdir()
    with tarfile.open(archive_path, mode="r:gz") as archive:
        for entry in manifest["files"]:
            name = entry["path"]
            if not name.startswith("evidence/"):
                continue
            member = archive.getmember(name)
            source = archive.extractfile(member)
            if source is None:
                raise BackupError(f"Evidence file cannot be read: {name}")
            target = staged_evidence / Path(name).name
            with source, target.open("xb") as destination:
                shutil.copyfileobj(source, destination)
            try:
                os.chmod(target, 0o600)
            except OSError:
                pass
    return evidence_count


def restore_backup(archive_path: Path, confirmed: bool) -> tuple[Path, int]:
    if not confirmed:
        raise BackupError("Restore requires --confirm. Stop the OriginalRoot service before restoring.")
    if archive_path.resolve() == DATA_PATH.resolve():
        raise BackupError("The backup archive cannot replace the database file")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="OriginalRoot-restore-", dir=DATA_DIR) as stage_name:
        stage = Path(stage_name)
        new_stage = stage / "new"
        evidence_count = stage_archive(archive_path, new_stage)
        safety_copy = create_backup()
        rollback_stage = stage / "current"
        stage_archive(safety_copy, rollback_stage)
        staged_database = new_stage / "OriginalRoot.sqlite3"
        staged_evidence = new_stage / "evidence"
        rollback_database = rollback_stage / "OriginalRoot.sqlite3"
        rollback_evidence = rollback_stage / "evidence"
        old_evidence = stage / "old-evidence"
        installed_database = installed_evidence = False
        try:
            for transient in (Path(f"{DATA_PATH}-wal"), Path(f"{DATA_PATH}-shm")):
                transient.unlink(missing_ok=True)
            if EVIDENCE_PATH.exists():
                os.replace(EVIDENCE_PATH, old_evidence)
            os.replace(staged_database, DATA_PATH)
            installed_database = True
            os.replace(staged_evidence, EVIDENCE_PATH)
            installed_evidence = True
        except OSError as exc:
            if installed_evidence and EVIDENCE_PATH.exists():
                shutil.rmtree(EVIDENCE_PATH)
            if installed_database and DATA_PATH.exists():
                DATA_PATH.unlink()
            shutil.copy2(rollback_database, DATA_PATH)
            if old_evidence.exists():
                shutil.rmtree(old_evidence)
            shutil.copytree(rollback_evidence, EVIDENCE_PATH)
            raise BackupError(f"Restore failed; the previous database and evidence were recovered. Safety copy: {safety_copy.name}. {exc}") from exc
        if old_evidence.exists():
            shutil.rmtree(old_evidence)
    return safety_copy, evidence_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage OriginalRoot's local database and evidence backups.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    create_parser = subparsers.add_parser("create", help="create a consistent database and evidence archive")
    create_parser.add_argument("--output-dir", type=Path, default=BACKUP_DIR)
    verify_parser = subparsers.add_parser("verify", help="check archive checksums and SQLite integrity")
    verify_parser.add_argument("archive", type=Path)
    restore_parser = subparsers.add_parser("restore", help="restore an archive after stopping OriginalRoot")
    restore_parser.add_argument("archive", type=Path)
    restore_parser.add_argument("--confirm", action="store_true", help="confirm OriginalRoot is stopped and data replacement is intended")
    args = parser.parse_args()
    try:
        if args.command == "create":
            archive = create_backup(args.output_dir)
            manifest, evidence_count = read_and_verify(archive)
            print(json.dumps({"status": "created_and_verified", "archive": str(archive), "files": len(manifest["files"]), "evidence_images": evidence_count}, indent=2))
        elif args.command == "verify":
            manifest, evidence_count = read_and_verify(args.archive)
            print(json.dumps({"status": "verified", "created_at": manifest.get("created_at"), "files": len(manifest["files"]), "evidence_images": evidence_count}, indent=2))
        else:
            safety_copy, evidence_count = restore_backup(args.archive, args.confirm)
            print(json.dumps({"status": "restored", "automatic_safety_copy": str(safety_copy), "evidence_images": evidence_count}, indent=2))
        return 0
    except (BackupError, OSError, sqlite3.Error, tarfile.TarError) as exc:
        print(f"backup error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
