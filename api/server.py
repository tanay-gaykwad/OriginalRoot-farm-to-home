"""Local OriginalRoot API for harvest offers, evidence review, fulfilment, and support."""

from __future__ import annotations

import json
import base64
import binascii
import hashlib
import hmac
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import uuid
from http.cookies import SimpleCookie
from contextlib import closing
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(os.environ.get("OriginalRoot_ROOT") or getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
CATALOG_PATH = ROOT / "src" / "catalog.json"
STATIC_PATH = ROOT / "dist"
DATA_PATH = Path(os.environ.get("OriginalRoot_DB_PATH", ROOT / ".data" / "OriginalRoot.sqlite3"))
EVIDENCE_PATH = DATA_PATH.parent / "evidence"
ROUTE_FEE = 24
MAX_BODY_BYTES = 16_384
MAX_EVIDENCE_BYTES = 2_000_000
MAX_EVIDENCE_REQUEST_BYTES = 2_750_000
EVIDENCE_MEDIA_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
OPERATOR_TOKEN = os.environ.get("OriginalRoot_OPERATOR_TOKEN", "")
COMMUNITIES = {"Mysuru", "Mandya", "Srirangapatna"}
PRODUCT_CATEGORIES = {"fresh", "staples"}
UNITS_BY_CATEGORY = {
    "fresh": {"kg", "500 g", "250 g", "bunch", "dozen"},
    "staples": {"kg", "quintal", "25 kg bag", "30 kg bag", "50 kg bag", "100 kg bag"},
}
SUPPORT_CATEGORIES = {"quality", "missing_or_wrong", "delivery", "damaged", "other"}
SUPPORT_RESOLUTIONS = {"replacement_review", "refund_review", "contact_me"}
SUPPORT_STATUSES = {"open", "investigating", "awaiting_customer", "resolved", "closed"}


def load_catalog() -> list[dict]:
    with CATALOG_PATH.open("r", encoding="utf-8") as source:
        catalog = json.load(source)
    for product in catalog:
        if product["received"] + product["pack"] + product["platform"] != product["price"]:
            raise ValueError(f"Price components do not add up for product {product['id']}")
    return catalog


CATALOG = load_catalog()
PRODUCTS = {item["id"]: item for item in CATALOG}


def connect_db() -> sqlite3.Connection:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATA_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS demo_orders (
            reference TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL,
            payment_status TEXT NOT NULL,
            items_json TEXT NOT NULL,
            farmer_total INTEGER NOT NULL,
            packing_total INTEGER NOT NULL,
            platform_total INTEGER NOT NULL,
            route_fee INTEGER NOT NULL,
            order_total INTEGER NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS harvest_demand (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            community TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_listings (
            id TEXT PRIMARY KEY,
            crop TEXT NOT NULL,
            farm_name TEXT NOT NULL,
            community TEXT NOT NULL,
            available_quantity INTEGER NOT NULL,
            unit TEXT NOT NULL,
            harvest_window TEXT NOT NULL,
            minimum_payout INTEGER NOT NULL,
            category TEXT NOT NULL DEFAULT 'unclassified',
            status TEXT NOT NULL,
            approved_quantity INTEGER,
            grade TEXT,
            grower_payout INTEGER,
            packing_cost INTEGER,
            platform_fee INTEGER,
            route_cost INTEGER,
            buyer_price INTEGER,
            decision_note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        )"""
    )
    listing_columns = {row["name"] for row in connection.execute("PRAGMA table_info(harvest_listings)")}
    if "category" not in listing_columns:
        connection.execute("ALTER TABLE harvest_listings ADD COLUMN category TEXT NOT NULL DEFAULT 'unclassified'")
        connection.execute(
            """UPDATE harvest_listings SET status='pending', decision_note='Classify this existing offer as fresh produce or grains, pulses, and oilseeds (staples), then review it again.',
               approved_quantity=NULL, grade=NULL, grower_payout=NULL, packing_cost=NULL, platform_fee=NULL,
               route_cost=NULL, buyer_price=NULL, reviewed_at=NULL WHERE status='published'"""
        )
    if "grower_id" not in listing_columns:
        connection.execute("ALTER TABLE harvest_listings ADD COLUMN grower_id TEXT")
    connection.execute("CREATE INDEX IF NOT EXISTS harvest_listings_grower_id_idx ON harvest_listings(grower_id, created_at DESC)")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS growers (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            farm_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS grower_sessions (
            token_hash TEXT PRIMARY KEY,
            grower_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS operator_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('owner', 'operator')),
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )"""
    )
    operator_columns = {row["name"] for row in connection.execute("PRAGMA table_info(operator_users)")}
    if "is_active" not in operator_columns:
        connection.execute("ALTER TABLE operator_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS operator_sessions (
            token_hash TEXT PRIMARY KEY,
            operator_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS operator_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_orders (
            reference TEXT PRIMARY KEY,
            listing_id TEXT NOT NULL,
            crop TEXT NOT NULL,
            farm_name TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            community TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit TEXT NOT NULL,
            grower_payout INTEGER NOT NULL,
            packing_cost INTEGER NOT NULL,
            platform_fee INTEGER NOT NULL,
            route_cost INTEGER NOT NULL,
            total INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )
    order_columns = {row["name"] for row in connection.execute("PRAGMA table_info(harvest_orders)")}
    for column, definition in {
        "fulfillment_method": "TEXT NOT NULL DEFAULT 'pickup'",
        "delivery_address": "TEXT NOT NULL DEFAULT ''",
        "delivery_code_hash": "TEXT NOT NULL DEFAULT ''",
        "proof_verified_at": "TEXT",
        "category": "TEXT NOT NULL DEFAULT 'unclassified'",
    }.items():
        if column not in order_columns:
            connection.execute(f"ALTER TABLE harvest_orders ADD COLUMN {column} {definition}")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_order_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_reference TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            note TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS support_tickets (
            id TEXT PRIMARY KEY,
            requester_type TEXT NOT NULL CHECK (requester_type IN ('customer', 'grower')),
            grower_id TEXT,
            order_reference TEXT,
            listing_id TEXT,
            category TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            requested_resolution TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            resolution_note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )
    connection.execute("CREATE INDEX IF NOT EXISTS support_tickets_grower_idx ON support_tickets(grower_id, created_at DESC)")
    connection.execute("CREATE INDEX IF NOT EXISTS support_tickets_order_idx ON support_tickets(order_reference, created_at DESC)")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS support_ticket_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            note TEXT NOT NULL,
            actor TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_passport_events (
            id TEXT PRIMARY KEY,
            listing_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            location TEXT NOT NULL,
            detail TEXT NOT NULL,
            recorded_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_evidence (
            id TEXT PRIMARY KEY,
            listing_id TEXT NOT NULL,
            grower_id TEXT NOT NULL,
            evidence_type TEXT NOT NULL,
            caption TEXT NOT NULL,
            media_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'declined')),
            review_note TEXT NOT NULL DEFAULT '',
            submitted_at TEXT NOT NULL,
            reviewed_at TEXT,
            reviewed_by TEXT
        )"""
    )
    connection.execute("CREATE INDEX IF NOT EXISTS harvest_evidence_listing_idx ON harvest_evidence(listing_id, review_status, submitted_at DESC)")
    connection.execute("CREATE INDEX IF NOT EXISTS harvest_evidence_grower_idx ON harvest_evidence(grower_id, submitted_at DESC)")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS harvest_evidence_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_id TEXT NOT NULL,
            action TEXT NOT NULL,
            note TEXT NOT NULL,
            actor TEXT NOT NULL,
            actor_role TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    return connection


def json_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class OriginalRootHandler(BaseHTTPRequestHandler):
    server_version = "OriginalRootLocal/0.2"

    def _headers(self, status: int, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'")
        self.send_header("X-Frame-Options", "DENY")

    def _send_json(self, status: int, payload: object, extra_headers: dict[str, str] | None = None) -> None:
        body = json_bytes(payload)
        self._headers(status)
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_evidence_file(self, content: bytes, media_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
        self.send_header("Content-Disposition", "inline")
        self.end_headers()
        self.wfile.write(content)

    def _read_json(self, max_bytes: int = MAX_BODY_BYTES) -> dict:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("Invalid request length") from exc
        if length < 1 or length > max_bytes:
            raise ValueError(f"Request body must be between 1 and {max_bytes} bytes")
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Request body must be valid JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object")
        return payload

    def _operator_authorized(self) -> bool:
        operator = self._operator_session()
        if operator is None:
            self._send_json(401, {"detail": "Sign in with an operator account"})
            return False
        self.current_operator = operator
        return True

    def _operator_session(self) -> sqlite3.Row | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            morsel = cookie.get("OriginalRoot_operator_session")
            if morsel is None:
                return None
            token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                return connection.execute(
                    """SELECT operator_users.id, operator_users.username, operator_users.full_name, operator_users.role
                       FROM operator_sessions JOIN operator_users ON operator_users.id = operator_sessions.operator_id
                       WHERE operator_sessions.token_hash = ? AND operator_sessions.expires_at > ? AND operator_users.is_active = 1""",
                    (token_hash, now),
                ).fetchone()
        except (sqlite3.Error, ValueError):
            return None

    @staticmethod
    def _operator_account_exists() -> bool:
        with closing(connect_db()) as connection:
            return connection.execute("SELECT 1 FROM operator_users WHERE is_active = 1 LIMIT 1").fetchone() is not None

    def _operator_is_owner(self) -> bool:
        if getattr(self, "current_operator", None) and self.current_operator["role"] == "owner":
            return True
        self._send_json(403, {"detail": "Only the workspace owner can manage operator accounts"})
        return False

    def _record_operator_audit(self, action: str, entity_type: str, entity_id: str, detail: str) -> None:
        operator = getattr(self, "current_operator", None)
        if operator is None:
            return
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with closing(connect_db()) as connection, connection:
            connection.execute(
                "INSERT INTO operator_audit (operator_id, operator_name, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (operator["id"], operator["full_name"], action, entity_type, entity_id, detail[:240], now),
            )

    def _grower_session(self) -> sqlite3.Row | None:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            morsel = cookie.get("OriginalRoot_session")
            if morsel is None:
                return None
            token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                return connection.execute(
                    """SELECT growers.id, growers.username, growers.farm_name, growers.created_at
                       FROM grower_sessions JOIN growers ON growers.id = grower_sessions.grower_id
                       WHERE grower_sessions.token_hash = ? AND grower_sessions.expires_at > ?""",
                    (token_hash, now),
                ).fetchone()
        except (sqlite3.Error, ValueError):
            return None

    @staticmethod
    def _session_cookie(token: str, *, clear: bool = False, cookie_name: str = "OriginalRoot_session") -> str:
        secure = "; Secure" if os.environ.get("OriginalRoot_COOKIE_SECURE") == "1" else ""
        if clear:
            return f"{cookie_name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict{secure}"
        return f"{cookie_name}={token}; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict{secure}"

    @staticmethod
    def _password_hash(password: str, salt_hex: str) -> str:
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 600_000, dklen=32)
        return digest.hex()

    @staticmethod
    def _session_token() -> tuple[str, str]:
        token = secrets.token_urlsafe(32)
        return token, hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _listing_payload(row: sqlite3.Row) -> dict:
        return {key: row[key] for key in row.keys()}

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlsplit(self.path).path
        if path == "/api/health":
            operator_ready = self._operator_account_exists()
            self._send_json(200, {"status": "ok", "mode": "local-pilot", "operator_review_enabled": operator_ready, "order_requests_enabled": operator_ready, "payments_enabled": False})
            return
        if path == "/api/grower/me":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in to your grower workspace"})
                return
            self._send_json(200, {"grower": {"id": grower["id"], "username": grower["username"], "farm_name": grower["farm_name"]}})
            return
        if path == "/api/grower/listings":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in to view your harvest offers"})
                return
            with closing(connect_db()) as connection:
                rows = connection.execute("SELECT id, crop, category, community, available_quantity, unit, harvest_window, minimum_payout, status, approved_quantity, grade, grower_payout, buyer_price, decision_note, created_at, reviewed_at FROM harvest_listings WHERE grower_id = ? ORDER BY created_at DESC", (grower["id"],)).fetchall()
            self._send_json(200, {"listings": [dict(row) for row in rows]})
            return
        if path == "/api/grower/evidence":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in to view your submitted evidence"})
                return
            with closing(connect_db()) as connection:
                rows = connection.execute(
                    """SELECT e.*, l.crop FROM harvest_evidence e
                       JOIN harvest_listings l ON l.id = e.listing_id
                       WHERE e.grower_id = ? ORDER BY e.submitted_at DESC""",
                    (grower["id"],),
                ).fetchall()
                events = connection.execute(
                    """SELECT v.* FROM harvest_evidence_events v
                       JOIN harvest_evidence e ON e.id = v.evidence_id
                       WHERE e.grower_id = ? ORDER BY v.id""",
                    (grower["id"],),
                ).fetchall()
            event_map: dict[str, list[dict]] = {}
            for event in events:
                event_map.setdefault(event["evidence_id"], []).append({"action": event["action"], "note": event["note"], "actor": event["actor"], "actor_role": event["actor_role"], "created_at": event["created_at"]})
            self._send_json(200, {"evidence": [{**dict(row), "file_url": f"/api/evidence/{row['id']}/file", "events": event_map.get(row["id"], [])} for row in rows]})
            return
        if path == "/api/grower/support-tickets":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in to view your support requests"})
                return
            with closing(connect_db()) as connection:
                rows = connection.execute(
                    """SELECT t.*, l.crop AS linked_crop FROM support_tickets t
                       LEFT JOIN harvest_listings l ON l.id = t.listing_id
                       WHERE t.requester_type = 'grower' AND t.grower_id = ? ORDER BY t.created_at DESC""",
                    (grower["id"],),
                ).fetchall()
                events = connection.execute(
                    """SELECT e.* FROM support_ticket_events e
                       JOIN support_tickets t ON t.id = e.ticket_id
                       WHERE t.requester_type = 'grower' AND t.grower_id = ? ORDER BY e.id""",
                    (grower["id"],),
                ).fetchall()
            event_map: dict[str, list[dict]] = {}
            for event in events:
                event_map.setdefault(event["ticket_id"], []).append({"from_status": event["from_status"], "to_status": event["to_status"], "note": event["note"], "actor": event["actor"], "created_at": event["created_at"]})
            self._send_json(200, {"tickets": [{**dict(row), "events": event_map.get(row["id"], [])} for row in rows]})
            return
        if path == "/api/operator/setup-status":
            with closing(connect_db()) as connection:
                has_operator = connection.execute("SELECT 1 FROM operator_users LIMIT 1").fetchone() is not None
            self._send_json(200, {"setup_required": not has_operator, "operator_access_configured": bool(OPERATOR_TOKEN)})
            return
        if path == "/api/operator/me":
            operator = self._operator_session()
            if operator is None:
                self._send_json(401, {"detail": "Sign in with an operator account"})
                return
            self.current_operator = operator
            self._send_json(200, {"operator": {key: operator[key] for key in ("id", "username", "full_name", "role")}})
            return
        if path == "/api/operator/users":
            if not self._operator_authorized() or not self._operator_is_owner():
                return
            with closing(connect_db()) as connection:
                users = connection.execute("SELECT id, username, full_name, role, created_at, is_active FROM operator_users ORDER BY created_at").fetchall()
            self._send_json(200, {"operators": [dict(row) for row in users]})
            return
        if path == "/api/operator/audit":
            if not self._operator_authorized():
                return
            with closing(connect_db()) as connection:
                rows = connection.execute("SELECT operator_name, action, entity_type, entity_id, detail, created_at FROM operator_audit ORDER BY id DESC LIMIT 100").fetchall()
            self._send_json(200, {"events": [dict(row) for row in rows]})
            return
        if path == "/api/operator/support-tickets":
            if not self._operator_authorized():
                return
            with closing(connect_db()) as connection:
                rows = connection.execute(
                    """SELECT t.*, o.customer_name, o.customer_phone, o.crop AS order_crop, g.farm_name
                       FROM support_tickets t LEFT JOIN harvest_orders o ON o.reference = t.order_reference
                       LEFT JOIN growers g ON g.id = t.grower_id
                       ORDER BY CASE WHEN t.status IN ('resolved', 'closed') THEN 1 ELSE 0 END, t.created_at ASC"""
                ).fetchall()
                events = connection.execute("SELECT * FROM support_ticket_events ORDER BY id").fetchall()
            event_map: dict[str, list[dict]] = {}
            for event in events:
                event_map.setdefault(event["ticket_id"], []).append({"from_status": event["from_status"], "to_status": event["to_status"], "note": event["note"], "actor": event["actor"], "created_at": event["created_at"]})
            self._send_json(200, {"tickets": [{**dict(row), "events": event_map.get(row["id"], [])} for row in rows]})
            return
        if path == "/api/products":
            self._send_json(200, {"mode": "sample-data", "products": CATALOG})
            return
        if path == "/api/harvest-demand":
            with closing(connect_db()) as connection:
                rows = connection.execute(
                    """SELECT product_id, community, SUM(quantity) AS quantity, COUNT(*) AS signals
                       FROM harvest_demand GROUP BY product_id, community ORDER BY product_id, community"""
                ).fetchall()
            self._send_json(200, {"mode": "local-pilot", "signals": [dict(row) for row in rows]})
            return
        if path == "/api/operator/passports":
            if not self._operator_authorized():
                return
            with closing(connect_db()) as connection:
                rows = connection.execute("SELECT id, crop, farm_name, community, approved_quantity, unit, grade FROM harvest_listings WHERE status = 'published' ORDER BY created_at DESC").fetchall()
                counts = {row["listing_id"]: row["count"] for row in connection.execute("SELECT listing_id, COUNT(*) AS count FROM harvest_passport_events GROUP BY listing_id").fetchall()}
                evidence_counts = {row["listing_id"]: row["count"] for row in connection.execute("SELECT listing_id, COUNT(*) AS count FROM harvest_evidence WHERE review_status = 'approved' GROUP BY listing_id").fetchall()}
            self._send_json(200, {"listings": [{**dict(row), "event_count": counts.get(row["id"], 0), "evidence_count": evidence_counts.get(row["id"], 0)} for row in rows]})
            return
        if path == "/api/operator/evidence":
            if not self._operator_authorized():
                return
            with closing(connect_db()) as connection:
                rows = connection.execute(
                    """SELECT e.*, l.crop, l.farm_name, l.community, g.username AS grower_username
                       FROM harvest_evidence e
                       JOIN harvest_listings l ON l.id = e.listing_id
                       JOIN growers g ON g.id = e.grower_id
                       ORDER BY CASE WHEN e.review_status = 'pending' THEN 0 ELSE 1 END, e.submitted_at ASC"""
                ).fetchall()
                events = connection.execute("SELECT * FROM harvest_evidence_events ORDER BY id").fetchall()
            event_map: dict[str, list[dict]] = {}
            for event in events:
                event_map.setdefault(event["evidence_id"], []).append({"action": event["action"], "note": event["note"], "actor": event["actor"], "actor_role": event["actor_role"], "created_at": event["created_at"]})
            self._send_json(200, {"evidence": [{**dict(row), "file_url": f"/api/evidence/{row['id']}/file", "events": event_map.get(row["id"], [])} for row in rows]})
            return
        if path.startswith("/api/evidence/") and path.endswith("/file"):
            evidence_id = path.removeprefix("/api/evidence/").removesuffix("/file").strip("/").upper()
            if not re.fullmatch(r"EVD-[0-9A-F]{16}", evidence_id):
                self._send_json(404, {"detail": "Evidence file not found"})
                return
            with closing(connect_db()) as connection:
                evidence = connection.execute(
                    """SELECT e.id, e.grower_id, e.listing_id, e.media_type, e.review_status, e.sha256, e.byte_size, l.status AS listing_status
                       FROM harvest_evidence e JOIN harvest_listings l ON l.id = e.listing_id WHERE e.id = ?""",
                    (evidence_id,),
                ).fetchone()
            if evidence is None:
                self._send_json(404, {"detail": "Evidence file not found"})
                return
            permitted = evidence["review_status"] == "approved" and evidence["listing_status"] == "published"
            if not permitted:
                grower = self._grower_session()
                operator = self._operator_session()
                permitted = bool((grower and grower["id"] == evidence["grower_id"]) or operator)
            extension = EVIDENCE_MEDIA_TYPES.get(evidence["media_type"])
            file_path = EVIDENCE_PATH / f"{evidence_id}{extension}" if extension else None
            if not permitted or file_path is None or not file_path.is_file():
                self._send_json(404, {"detail": "Evidence file not found"})
                return
            try:
                content = file_path.read_bytes()
            except OSError:
                self._send_json(404, {"detail": "Evidence file not found"})
                return
            if len(content) != evidence["byte_size"] or not hmac.compare_digest(hashlib.sha256(content).hexdigest(), evidence["sha256"]):
                self._send_json(500, {"detail": "Evidence file integrity check failed"})
                return
            self._send_evidence_file(content, evidence["media_type"])
            return
        if path.startswith("/api/harvest-listings/") and path.endswith("/passport"):
            listing_id = path.removeprefix("/api/harvest-listings/").removesuffix("/passport").strip("/").upper()
            if not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id):
                self._send_json(404, {"detail": "Batch passport not found"})
                return
            with closing(connect_db()) as connection:
                listing = connection.execute("SELECT * FROM harvest_listings WHERE id = ? AND status = 'published' AND category IN ('fresh', 'staples')", (listing_id,)).fetchone()
                events = connection.execute("SELECT event_type, location, detail, recorded_by, created_at FROM harvest_passport_events WHERE listing_id = ? ORDER BY rowid", (listing_id,)).fetchall()
                evidence_rows = connection.execute(
                    """SELECT id, evidence_type, caption, media_type, byte_size, sha256, submitted_at, reviewed_at
                       FROM harvest_evidence WHERE listing_id = ? AND review_status = 'approved' ORDER BY reviewed_at, id""",
                    (listing_id,),
                ).fetchall()
            if listing is None:
                self._send_json(404, {"detail": "Batch passport not found"})
                return
            passport = {key: listing[key] for key in ("id", "crop", "category", "farm_name", "community", "approved_quantity", "unit", "harvest_window", "grade", "grower_payout", "packing_cost", "platform_fee", "route_cost", "buyer_price", "reviewed_at")}
            published_evidence = [{**dict(item), "file_url": f"/api/evidence/{item['id']}/file", "reviewer_role": "OriginalRoot operator"} for item in evidence_rows]
            self._send_json(200, {"passport": passport, "events": [dict(event) for event in events], "evidence": published_evidence, "record_note": "An operator reviewed the listed evidence. This review is not independent certification and cannot guarantee that every claim is accurate. Other handling notes are operator-recorded."})
            return
        if path == "/api/operator/orders":
            if not self._operator_authorized():
                return
            with closing(connect_db()) as connection:
                rows = connection.execute("SELECT * FROM harvest_orders ORDER BY created_at DESC").fetchall()
                events = connection.execute("SELECT * FROM harvest_order_events ORDER BY id").fetchall()
            event_map: dict[str, list[dict]] = {}
            for event in events:
                event_map.setdefault(event["order_reference"], []).append({"from_status": event["from_status"], "to_status": event["to_status"], "note": event["note"], "created_at": event["created_at"]})
            self._send_json(200, {"orders": [{**dict(row), "events": event_map.get(row["reference"], [])} for row in rows]})
            return
        if path.startswith("/api/orders/"):
            reference = path.removeprefix("/api/orders/").upper()
            if not re.fullmatch(r"VAV-[0-9A-F]{16}", reference):
                self._send_json(404, {"detail": "Order reference not found"})
                return
            with closing(connect_db()) as connection:
                row = connection.execute("SELECT * FROM harvest_orders WHERE reference = ?", (reference,)).fetchone()
                events = connection.execute("SELECT to_status, note, created_at FROM harvest_order_events WHERE order_reference = ? ORDER BY id", (reference,)).fetchall()
                latest = connection.execute("SELECT note FROM harvest_order_events WHERE order_reference = ? ORDER BY id DESC LIMIT 1", (reference,)).fetchone()
            if row is None:
                self._send_json(404, {"detail": "Order reference not found"})
                return
            self._send_json(200, {"reference": row["reference"], "crop": row["crop"], "category": row["category"], "quantity": row["quantity"], "unit": row["unit"], "total": row["total"], "status": row["status"], "fulfillment_method": row["fulfillment_method"], "latest_note": latest["note"] if latest else "", "events": [dict(event) for event in events], "created_at": row["created_at"], "updated_at": row["updated_at"]})
            return
        if path == "/api/harvest-listings":
            params = dict(part.split("=", 1) for part in urlsplit(self.path).query.split("&") if "=" in part)
            if params.get("scope") == "review":
                if not self._operator_authorized():
                    return
                query = "SELECT * FROM harvest_listings WHERE status = 'pending' ORDER BY created_at"
            else:
                query = "SELECT * FROM harvest_listings WHERE status = 'published' AND category IN ('fresh', 'staples') ORDER BY created_at DESC"
            with closing(connect_db()) as connection:
                rows = connection.execute(query).fetchall()
                public_keys = ("id", "crop", "category", "farm_name", "community", "approved_quantity", "unit", "harvest_window", "grade", "grower_payout", "packing_cost", "platform_fee", "route_cost", "buyer_price", "reviewed_at")
                payloads = []
                for row in rows:
                    if params.get("scope") == "review":
                        payloads.append(self._listing_payload(row))
                    else:
                        payload = {key: row[key] for key in public_keys}
                        reserved = connection.execute("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM harvest_orders WHERE listing_id = ? AND status != 'cancelled'", (row["id"],)).fetchone()["quantity"]
                        payload["remaining_quantity"] = max(0, row["approved_quantity"] - reserved)
                        payloads.append(payload)
            self._send_json(200, {"listings": payloads})
            return
        if path.startswith("/api/demo/orders/"):
            reference = path.removeprefix("/api/demo/orders/").upper()
            if not reference or "/" in reference:
                self._send_json(404, {"detail": "Demo order not found"})
                return
            with closing(connect_db()) as connection, connection:
                row = connection.execute(
                    "SELECT * FROM demo_orders WHERE reference = ?", (reference,)
                ).fetchone()
            if row is None:
                self._send_json(404, {"detail": "Demo order not found"})
                return
            self._send_json(200, self._order_payload(row))
            return
        if path.startswith("/api/"):
            self._send_json(404, {"detail": "API route not found"})
            return
        self._serve_static(path)

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        request_path = urlsplit(self.path).path
        if request_path == "/api/operator/bootstrap":
            if not OPERATOR_TOKEN:
                self._send_json(503, {"detail": "Set the local bootstrap key before setting up the first operator"})
                return
            try:
                payload = self._read_json()
                bootstrap_key = payload.get("bootstrap_key")
                full_name = payload.get("full_name")
                username = payload.get("username")
                password = payload.get("password")
                if not isinstance(bootstrap_key, str) or not hmac.compare_digest(bootstrap_key.encode(), OPERATOR_TOKEN.encode()):
                    self._send_json(401, {"detail": "Bootstrap key is invalid"})
                    return
                if not isinstance(full_name, str) or not 2 <= len(full_name.strip()) <= 80:
                    raise ValueError("Name must be 2 to 80 characters")
                if not isinstance(username, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{3,32}", username):
                    raise ValueError("Username must be 3 to 32 letters, numbers, dots, dashes, or underscores")
                if not isinstance(password, str) or not 12 <= len(password) <= 128:
                    raise ValueError("Password must be 12 to 128 characters")
                username = username.lower()
                salt = secrets.token_hex(16)
                password_hash = self._password_hash(password, salt)
                operator_id = uuid.uuid4().hex
                now = datetime.now(timezone.utc)
                token, token_hash = self._session_token()
                with closing(connect_db()) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    if connection.execute("SELECT 1 FROM operator_users LIMIT 1").fetchone():
                        connection.rollback()
                        self._send_json(409, {"detail": "Operator setup has already been completed"})
                        return
                    connection.execute("INSERT INTO operator_users (id, username, full_name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, 'owner', ?, ?, ?)", (operator_id, username, full_name.strip(), password_hash, salt, now.isoformat(timespec="seconds")))
                    connection.execute("INSERT INTO operator_sessions (token_hash, operator_id, expires_at, created_at) VALUES (?, ?, ?, ?)", (token_hash, operator_id, (now + timedelta(days=7)).isoformat(timespec="seconds"), now.isoformat(timespec="seconds")))
                    connection.execute("INSERT INTO operator_audit (operator_id, operator_name, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'owner_created', 'operator', ?, 'Initial workspace owner setup', ?)", (operator_id, full_name.strip(), operator_id, now.isoformat(timespec="seconds")))
                    connection.commit()
            except sqlite3.IntegrityError:
                self._send_json(409, {"detail": "That username is already in use"})
                return
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(201, {"operator": {"id": operator_id, "username": username, "full_name": full_name.strip(), "role": "owner"}}, {"Set-Cookie": self._session_cookie(token, cookie_name="OriginalRoot_operator_session")})
            return
        if request_path == "/api/operator/login":
            try:
                payload = self._read_json()
                username = payload.get("username")
                password = payload.get("password")
                if not isinstance(username, str) or not isinstance(password, str) or len(username) > 32 or len(password) > 128:
                    raise ValueError("Enter a valid username and password")
                with closing(connect_db()) as connection:
                    operator = connection.execute("SELECT id, username, full_name, role, password_hash, password_salt FROM operator_users WHERE username = ? AND is_active = 1", (username.lower(),)).fetchone()
                supplied_hash = self._password_hash(password, operator["password_salt"] if operator else "00" * 16)
                if operator is None or not hmac.compare_digest(supplied_hash, operator["password_hash"]):
                    self._send_json(401, {"detail": "Username or password is incorrect"})
                    return
                now = datetime.now(timezone.utc)
                token, token_hash = self._session_token()
                with closing(connect_db()) as connection, connection:
                    connection.execute("DELETE FROM operator_sessions WHERE expires_at <= ?", (now.isoformat(timespec="seconds"),))
                    connection.execute("INSERT INTO operator_sessions (token_hash, operator_id, expires_at, created_at) VALUES (?, ?, ?, ?)", (token_hash, operator["id"], (now + timedelta(days=7)).isoformat(timespec="seconds"), now.isoformat(timespec="seconds")))
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(200, {"operator": {key: operator[key] for key in ("id", "username", "full_name", "role")}}, {"Set-Cookie": self._session_cookie(token, cookie_name="OriginalRoot_operator_session")})
            return
        if request_path == "/api/operator/logout":
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                morsel = cookie.get("OriginalRoot_operator_session")
                if morsel:
                    token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
                    with closing(connect_db()) as connection, connection:
                        connection.execute("DELETE FROM operator_sessions WHERE token_hash = ?", (token_hash,))
            except (sqlite3.Error, ValueError):
                pass
            self._send_json(200, {"status": "signed_out"}, {"Set-Cookie": self._session_cookie("", clear=True, cookie_name="OriginalRoot_operator_session")})
            return
        if request_path == "/api/operator/password":
            if not self._operator_authorized():
                return
            try:
                payload = self._read_json()
                current_password = payload.get("current_password")
                new_password = payload.get("new_password")
                if not isinstance(current_password, str) or len(current_password) > 128:
                    raise ValueError("Enter your current password")
                if not isinstance(new_password, str) or not 12 <= len(new_password) <= 128:
                    raise ValueError("New password must be 12 to 128 characters")
                with closing(connect_db()) as connection:
                    account = connection.execute("SELECT password_hash, password_salt FROM operator_users WHERE id = ?", (self.current_operator["id"],)).fetchone()
                current_hash = self._password_hash(current_password, account["password_salt"])
                if not hmac.compare_digest(current_hash, account["password_hash"]):
                    self._send_json(401, {"detail": "Current password is incorrect"})
                    return
                salt = secrets.token_hex(16)
                password_hash = self._password_hash(new_password, salt)
                now = datetime.now(timezone.utc)
                token, token_hash = self._session_token()
                with closing(connect_db()) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    connection.execute("UPDATE operator_users SET password_hash = ?, password_salt = ? WHERE id = ?", (password_hash, salt, self.current_operator["id"]))
                    connection.execute("DELETE FROM operator_sessions WHERE operator_id = ?", (self.current_operator["id"],))
                    connection.execute("INSERT INTO operator_sessions (token_hash, operator_id, expires_at, created_at) VALUES (?, ?, ?, ?)", (token_hash, self.current_operator["id"], (now + timedelta(days=7)).isoformat(timespec="seconds"), now.isoformat(timespec="seconds")))
                    connection.execute("INSERT INTO operator_audit (operator_id, operator_name, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'password_changed', 'operator', ?, 'Operator changed their password; previous sessions revoked', ?)", (self.current_operator["id"], self.current_operator["full_name"], self.current_operator["id"], now.isoformat(timespec="seconds")))
                    connection.commit()
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(200, {"status": "password_changed"}, {"Set-Cookie": self._session_cookie(token, cookie_name="OriginalRoot_operator_session")})
            return
        if request_path == "/api/operator/users":
            if not self._operator_authorized() or not self._operator_is_owner():
                return
            try:
                payload = self._read_json()
                full_name = payload.get("full_name")
                username = payload.get("username")
                password = payload.get("password")
                if not isinstance(full_name, str) or not 2 <= len(full_name.strip()) <= 80:
                    raise ValueError("Name must be 2 to 80 characters")
                if not isinstance(username, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{3,32}", username):
                    raise ValueError("Username must be 3 to 32 letters, numbers, dots, dashes, or underscores")
                if not isinstance(password, str) or not 12 <= len(password) <= 128:
                    raise ValueError("Password must be 12 to 128 characters")
                username = username.lower()
                salt = secrets.token_hex(16)
                password_hash = self._password_hash(password, salt)
                operator_id = uuid.uuid4().hex
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with closing(connect_db()) as connection, connection:
                    connection.execute("INSERT INTO operator_users (id, username, full_name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, 'operator', ?, ?, ?)", (operator_id, username, full_name.strip(), password_hash, salt, now))
                self._record_operator_audit("operator_created", "operator", operator_id, f"Created operator account @{username}")
            except sqlite3.IntegrityError:
                self._send_json(409, {"detail": "That username is already in use"})
                return
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(201, {"operator": {"id": operator_id, "username": username, "full_name": full_name.strip(), "role": "operator", "created_at": now}})
            return
        if request_path.startswith("/api/operator/users/") and request_path.endswith("/status"):
            if not self._operator_authorized() or not self._operator_is_owner():
                return
            operator_id = request_path.removeprefix("/api/operator/users/").removesuffix("/status").strip("/").lower()
            try:
                payload = self._read_json()
                is_active = payload.get("is_active")
                if not re.fullmatch(r"[0-9a-f]{32}", operator_id):
                    raise ValueError("Choose a valid operator account")
                if not isinstance(is_active, bool):
                    raise ValueError("Choose whether the operator account should be active")
                if operator_id == self.current_operator["id"]:
                    raise ValueError("You cannot disable your own owner account")
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with closing(connect_db()) as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    user = connection.execute("SELECT id, username, role, is_active FROM operator_users WHERE id = ?", (operator_id,)).fetchone()
                    if user is None:
                        connection.rollback()
                        self._send_json(404, {"detail": "Operator account not found"})
                        return
                    if user["role"] != "operator":
                        connection.rollback()
                        self._send_json(409, {"detail": "Owner accounts cannot be suspended here"})
                        return
                    if bool(user["is_active"]) == is_active:
                        connection.rollback()
                        self._send_json(200, {"id": operator_id, "is_active": is_active, "changed": False})
                        return
                    connection.execute("UPDATE operator_users SET is_active = ? WHERE id = ?", (int(is_active), operator_id))
                    if not is_active:
                        connection.execute("DELETE FROM operator_sessions WHERE operator_id = ?", (operator_id,))
                    action = "operator_reactivated" if is_active else "operator_suspended"
                    detail = f"{'Reactivated' if is_active else 'Suspended'} operator @{user['username']}"
                    connection.execute(
                        "INSERT INTO operator_audit (operator_id, operator_name, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, ?, 'operator', ?, ?, ?)",
                        (self.current_operator["id"], self.current_operator["full_name"], action, operator_id, detail, now),
                    )
                    connection.commit()
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            except sqlite3.Error:
                self._send_json(503, {"detail": "Could not update the operator account. Please retry."})
                return
            self._send_json(200, {"id": operator_id, "is_active": is_active, "changed": True, "updated_at": now})
            return
        if request_path == "/api/grower/register":
            try:
                payload = self._read_json()
                farm_name = payload.get("farm_name")
                username = payload.get("username")
                password = payload.get("password")
                if not isinstance(farm_name, str) or not 2 <= len(farm_name.strip()) <= 80:
                    raise ValueError("Farm or collective name must be 2 to 80 characters")
                if not isinstance(username, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{3,32}", username):
                    raise ValueError("Username must be 3 to 32 letters, numbers, dots, dashes, or underscores")
                if not isinstance(password, str) or not 12 <= len(password) <= 128:
                    raise ValueError("Password must be 12 to 128 characters")
                username = username.lower()
                salt = secrets.token_hex(16)
                password_hash = self._password_hash(password, salt)
                grower_id = uuid.uuid4().hex
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                token, token_hash = self._session_token()
                with closing(connect_db()) as connection, connection:
                    connection.execute("DELETE FROM grower_sessions WHERE expires_at <= ?", (now,))
                    connection.execute("INSERT INTO growers (id, username, farm_name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)", (grower_id, username, farm_name.strip(), password_hash, salt, now))
                    connection.execute("INSERT INTO grower_sessions (token_hash, grower_id, expires_at, created_at) VALUES (?, ?, ?, ?)", (token_hash, grower_id, (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(timespec="seconds"), now))
            except sqlite3.IntegrityError:
                self._send_json(409, {"detail": "That username is already in use"})
                return
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(201, {"grower": {"id": grower_id, "username": username, "farm_name": farm_name.strip()}}, {"Set-Cookie": self._session_cookie(token)})
            return
        if request_path == "/api/grower/login":
            try:
                payload = self._read_json()
                username = payload.get("username")
                password = payload.get("password")
                if not isinstance(username, str) or not isinstance(password, str) or len(username) > 32 or len(password) > 128:
                    raise ValueError("Enter a valid username and password")
                with closing(connect_db()) as connection:
                    account = connection.execute("SELECT id, username, farm_name, password_hash, password_salt FROM growers WHERE username = ?", (username.lower(),)).fetchone()
                supplied_hash = self._password_hash(password, account["password_salt"] if account else "00" * 16)
                if account is None or not hmac.compare_digest(supplied_hash, account["password_hash"]):
                    self._send_json(401, {"detail": "Username or password is incorrect"})
                    return
                now = datetime.now(timezone.utc)
                token, token_hash = self._session_token()
                with closing(connect_db()) as connection, connection:
                    connection.execute("DELETE FROM grower_sessions WHERE expires_at <= ?", (now.isoformat(timespec="seconds"),))
                    connection.execute("INSERT INTO grower_sessions (token_hash, grower_id, expires_at, created_at) VALUES (?, ?, ?, ?)", (token_hash, account["id"], (now + timedelta(days=7)).isoformat(timespec="seconds"), now.isoformat(timespec="seconds")))
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            self._send_json(200, {"grower": {"id": account["id"], "username": account["username"], "farm_name": account["farm_name"]}}, {"Set-Cookie": self._session_cookie(token)})
            return
        if request_path == "/api/grower/logout":
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                morsel = cookie.get("OriginalRoot_session")
                if morsel:
                    token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
                    with closing(connect_db()) as connection, connection:
                        connection.execute("DELETE FROM grower_sessions WHERE token_hash = ?", (token_hash,))
            except (sqlite3.Error, ValueError):
                pass
            self._send_json(200, {"status": "signed_out"}, {"Set-Cookie": self._session_cookie("", clear=True)})
            return
        if request_path == "/api/grower/evidence":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in before submitting batch evidence"})
                return
            try:
                payload = self._read_json(max_bytes=MAX_EVIDENCE_REQUEST_BYTES)
                listing_id = payload.get("listing_id")
                evidence_type = payload.get("evidence_type")
                caption = payload.get("caption")
                media_type = payload.get("media_type")
                encoded_file = payload.get("file_base64")
                if not isinstance(listing_id, str) or not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id.upper()):
                    raise ValueError("Choose one of your own valid harvest offers")
                listing_id = listing_id.upper()
                if not isinstance(evidence_type, str) or evidence_type not in {"field", "harvest", "weight", "grade", "packing", "other"}:
                    raise ValueError("Choose an evidence category")
                if not isinstance(caption, str) or not 4 <= len(caption.strip()) <= 180:
                    raise ValueError("Describe the evidence in 4 to 180 characters")
                if not isinstance(media_type, str) or media_type not in EVIDENCE_MEDIA_TYPES:
                    raise ValueError("Upload a JPEG, PNG, or WebP image")
                if not isinstance(encoded_file, str) or not encoded_file:
                    raise ValueError("Choose an image to upload")
                content = base64.b64decode(encoded_file, validate=True)
                if not 1 <= len(content) <= MAX_EVIDENCE_BYTES:
                    raise ValueError("Evidence images must be no larger than 2 MB")
                signature_ok = (
                    (media_type == "image/jpeg" and content.startswith(b"\xff\xd8\xff"))
                    or (media_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n"))
                    or (media_type == "image/webp" and len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP")
                )
                if not signature_ok:
                    raise ValueError("The selected file does not match its image type")
            except (ValueError, binascii.Error) as exc:
                self._send_json(400, {"detail": str(exc) or "Evidence image could not be decoded"})
                return
            with closing(connect_db()) as connection:
                listing = connection.execute(
                    "SELECT id FROM harvest_listings WHERE id = ? AND grower_id = ? AND status IN ('pending', 'published')",
                    (listing_id, grower["id"]),
                ).fetchone()
                if listing is None:
                    self._send_json(404, {"detail": "That harvest offer is not available on your account"})
                    return
                evidence_id = f"EVD-{uuid.uuid4().hex[:16].upper()}"
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                sha256 = hashlib.sha256(content).hexdigest()
                file_path = EVIDENCE_PATH / f"{evidence_id}{EVIDENCE_MEDIA_TYPES[media_type]}"
                try:
                    EVIDENCE_PATH.mkdir(parents=True, exist_ok=True)
                    with file_path.open("xb") as evidence_file:
                        evidence_file.write(content)
                    try:
                        os.chmod(file_path, 0o600)
                    except OSError:
                        pass
                    with connection:
                        connection.execute(
                            """INSERT INTO harvest_evidence
                               (id, listing_id, grower_id, evidence_type, caption, media_type, byte_size, sha256, review_status, submitted_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                            (evidence_id, listing_id, grower["id"], evidence_type, caption.strip(), media_type, len(content), sha256, now),
                        )
                        connection.execute(
                            "INSERT INTO harvest_evidence_events (evidence_id, action, note, actor, actor_role, created_at) VALUES (?, 'submitted', ?, ?, 'grower', ?)",
                            (evidence_id, caption.strip(), grower["farm_name"], now),
                        )
                except (OSError, sqlite3.Error):
                    try:
                        file_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    self._send_json(503, {"detail": "Could not safely save the evidence. Please retry."})
                    return
            self._send_json(201, {"id": evidence_id, "review_status": "pending", "message": "Evidence saved privately and sent for operator review."})
            return
        if request_path == "/api/support/customer-tickets":
            try:
                payload = self._read_json()
                order_reference = payload.get("order_reference")
                customer_phone = payload.get("customer_phone")
                category = payload.get("category")
                subject = payload.get("subject")
                message = payload.get("message")
                requested_resolution = payload.get("requested_resolution")
                if not isinstance(order_reference, str) or not re.fullmatch(r"VAV-[0-9A-F]{16}", order_reference.upper()):
                    raise ValueError("Enter the order reference shown at checkout")
                if not isinstance(customer_phone, str) or not re.fullmatch(r"[6-9][0-9]{9}", customer_phone):
                    raise ValueError("Enter the 10-digit mobile number used for this order")
                if not isinstance(category, str) or category not in SUPPORT_CATEGORIES:
                    raise ValueError("Choose an issue category")
                if not isinstance(subject, str) or not 4 <= len(subject.strip()) <= 120:
                    raise ValueError("Summary must be 4 to 120 characters")
                if not isinstance(message, str) or not 12 <= len(message.strip()) <= 1500:
                    raise ValueError("Describe the issue in 12 to 1500 characters")
                if not isinstance(requested_resolution, str) or requested_resolution not in SUPPORT_RESOLUTIONS:
                    raise ValueError("Choose a preferred resolution")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            order_reference = order_reference.upper()
            with closing(connect_db()) as connection:
                order = connection.execute("SELECT reference, customer_phone, listing_id FROM harvest_orders WHERE reference = ?", (order_reference,)).fetchone()
                if order is None or not hmac.compare_digest(order["customer_phone"].encode("utf-8"), customer_phone.encode("utf-8")):
                    self._send_json(404, {"detail": "We could not match that order and mobile number"})
                    return
                ticket_id = f"SUP-{uuid.uuid4().hex[:16].upper()}"
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with connection:
                    connection.execute(
                        """INSERT INTO support_tickets (id, requester_type, order_reference, listing_id, category, subject, message, requested_resolution, status, created_at, updated_at)
                           VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, 'open', ?, ?)""",
                        (ticket_id, order_reference, order["listing_id"], category, subject.strip(), message.strip(), requested_resolution, now, now),
                    )
                    connection.execute("INSERT INTO support_ticket_events (ticket_id, from_status, to_status, note, actor, created_at) VALUES (?, NULL, 'open', 'Issue submitted for review', 'Customer', ?)", (ticket_id, now))
            self._send_json(201, {"ticket_id": ticket_id, "status": "open", "message": "Your support request is recorded. Keep the ticket ID to check for updates."})
            return
        if request_path == "/api/support/customer-ticket-status":
            try:
                payload = self._read_json()
                ticket_id = payload.get("ticket_id")
                customer_phone = payload.get("customer_phone")
                if not isinstance(ticket_id, str) or not re.fullmatch(r"SUP-[0-9A-F]{16}", ticket_id.upper()):
                    raise ValueError("Enter a valid support ticket ID")
                if not isinstance(customer_phone, str) or not re.fullmatch(r"[6-9][0-9]{9}", customer_phone):
                    raise ValueError("Enter the 10-digit mobile number used for the order")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            ticket_id = ticket_id.upper()
            with closing(connect_db()) as connection:
                ticket = connection.execute("SELECT t.* FROM support_tickets t JOIN harvest_orders o ON o.reference = t.order_reference WHERE t.id = ? AND t.requester_type = 'customer'", (ticket_id,)).fetchone()
                if ticket is None:
                    self._send_json(404, {"detail": "Support ticket not found"})
                    return
                order = connection.execute("SELECT customer_phone FROM harvest_orders WHERE reference = ?", (ticket["order_reference"],)).fetchone()
                if order is None or not hmac.compare_digest(order["customer_phone"].encode("utf-8"), customer_phone.encode("utf-8")):
                    self._send_json(404, {"detail": "Support ticket not found"})
                    return
                events = connection.execute("SELECT from_status, to_status, note, actor, created_at FROM support_ticket_events WHERE ticket_id = ? ORDER BY id", (ticket_id,)).fetchall()
            self._send_json(200, {"ticket": {key: ticket[key] for key in ("id", "order_reference", "category", "subject", "message", "requested_resolution", "status", "resolution_note", "created_at", "updated_at")}, "events": [dict(event) for event in events]})
            return
        if request_path == "/api/grower/support-tickets":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in before contacting OriginalRoot support"})
                return
            try:
                payload = self._read_json()
                category = payload.get("category")
                subject = payload.get("subject")
                message = payload.get("message")
                listing_id = payload.get("listing_id", "")
                if not isinstance(category, str) or category not in {"offer_review", "quality", "payout_question", "other"}:
                    raise ValueError("Choose a grievance category")
                if not isinstance(subject, str) or not 4 <= len(subject.strip()) <= 120:
                    raise ValueError("Summary must be 4 to 120 characters")
                if not isinstance(message, str) or not 12 <= len(message.strip()) <= 1500:
                    raise ValueError("Describe your concern in 12 to 1500 characters")
                if not isinstance(listing_id, str) or (listing_id and not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id)):
                    raise ValueError("Choose one of your own valid harvest offers")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            with closing(connect_db()) as connection:
                if listing_id:
                    listing = connection.execute("SELECT id FROM harvest_listings WHERE id = ? AND grower_id = ?", (listing_id, grower["id"])).fetchone()
                    if listing is None:
                        self._send_json(404, {"detail": "That harvest offer is not part of your account"})
                        return
                ticket_id = f"SUP-{uuid.uuid4().hex[:16].upper()}"
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with connection:
                    connection.execute(
                        """INSERT INTO support_tickets (id, requester_type, grower_id, listing_id, category, subject, message, requested_resolution, status, created_at, updated_at)
                           VALUES (?, 'grower', ?, ?, ?, ?, ?, 'operator_review', 'open', ?, ?)""",
                        (ticket_id, grower["id"], listing_id or None, category, subject.strip(), message.strip(), now, now),
                    )
                    connection.execute("INSERT INTO support_ticket_events (ticket_id, from_status, to_status, note, actor, created_at) VALUES (?, NULL, 'open', 'Grievance submitted for review', ?, ?)", (ticket_id, grower["farm_name"], now))
            self._send_json(201, {"ticket_id": ticket_id, "status": "open", "message": "Your grievance is recorded and linked to your grower account."})
            return
        if request_path == "/api/orders":
            if not self._operator_account_exists():
                self._send_json(503, {"detail": "Order requests are disabled until the first operator account is created"})
                return
            try:
                payload = self._read_json()
                listing_id = payload.get("listing_id")
                customer_name = payload.get("customer_name")
                customer_phone = payload.get("customer_phone")
                community = payload.get("community")
                quantity = payload.get("quantity")
                fulfillment_method = payload.get("fulfillment_method", "pickup")
                delivery_address = payload.get("delivery_address", "")
                if not isinstance(listing_id, str) or not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id):
                    raise ValueError("Choose a current OriginalRoot harvest offer")
                if not isinstance(customer_name, str) or not 2 <= len(customer_name.strip()) <= 80:
                    raise ValueError("Name must be 2 to 80 characters")
                if not isinstance(customer_phone, str) or not re.fullmatch(r"[6-9][0-9]{9}", customer_phone):
                    raise ValueError("Enter a valid 10-digit Indian mobile number")
                if not isinstance(community, str) or community not in COMMUNITIES:
                    raise ValueError("Choose a supported delivery community")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100:
                    raise ValueError("Quantity must be between 1 and 100 units")
                if not isinstance(fulfillment_method, str) or fulfillment_method not in {"pickup", "delivery"}:
                    raise ValueError("Choose pickup or local delivery")
                if fulfillment_method == "delivery" and (not isinstance(delivery_address, str) or not 12 <= len(delivery_address.strip()) <= 240):
                    raise ValueError("Enter a delivery address between 12 and 240 characters")
                if fulfillment_method == "pickup":
                    delivery_address = ""
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            reference = f"VAV-{uuid.uuid4().hex[:16].upper()}"
            delivery_code = f"{secrets.randbelow(1_000_000):06d}" if fulfillment_method == "delivery" else ""
            delivery_code_hash = hashlib.sha256(f"{reference}:{delivery_code}".encode("utf-8")).hexdigest() if delivery_code else ""
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    listing = connection.execute("SELECT * FROM harvest_listings WHERE id = ? AND status = 'published'", (listing_id,)).fetchone()
                    if listing is None or listing["community"] != community:
                        connection.rollback()
                        self._send_json(404, {"detail": "That harvest is no longer available in this community"})
                        return
                    if listing["category"] not in PRODUCT_CATEGORIES:
                        connection.rollback()
                        self._send_json(409, {"detail": "This offer needs a category review before customer requests can be accepted"})
                        return
                    reserved = connection.execute("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM harvest_orders WHERE listing_id = ? AND status != 'cancelled'", (listing_id,)).fetchone()["quantity"]
                    if quantity > listing["approved_quantity"] - reserved:
                        connection.rollback()
                        self._send_json(409, {"detail": "There is not enough unreserved quantity in this harvest"})
                        return
                    total = listing["buyer_price"] * quantity
                    connection.execute(
                        """INSERT INTO harvest_orders (reference, listing_id, crop, category, farm_name, customer_name, customer_phone, community, quantity, unit, grower_payout, packing_cost, platform_fee, route_cost, total, status, created_at, updated_at, fulfillment_method, delivery_address, delivery_code_hash)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?)""",
                        (reference, listing_id, listing["crop"], listing["category"], listing["farm_name"], customer_name.strip(), customer_phone, community, quantity, listing["unit"], listing["grower_payout"] * quantity, listing["packing_cost"] * quantity, listing["platform_fee"] * quantity, listing["route_cost"] * quantity, total, now, now, fulfillment_method, delivery_address.strip(), delivery_code_hash),
                    )
                    initial_note = "Customer requested local delivery; no payment was collected" if fulfillment_method == "delivery" else "Customer requested a pickup order; payment not collected"
                    connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, NULL, 'requested', ?, ?)", (reference, initial_note, now))
                    connection.commit()
                except sqlite3.Error:
                    connection.rollback()
                    self._send_json(503, {"detail": "Could not record the order. Please try again."})
                    return
            self._send_json(201, {"reference": reference, "status": "requested", "crop": listing["crop"], "quantity": quantity, "unit": listing["unit"], "total": total, "fulfillment_method": fulfillment_method, "delivery_code": delivery_code, "message": "Request recorded. Wait for operator confirmation; no payment was collected."})
            return
        if request_path.startswith("/api/operator/orders/") and request_path.endswith("/status"):
            if not self._operator_authorized():
                return
            reference = request_path.removeprefix("/api/operator/orders/").removesuffix("/status").strip("/").upper()
            try:
                payload = self._read_json()
                new_status = payload.get("status")
                note = payload.get("note", "")
                if not isinstance(new_status, str):
                    raise ValueError("Choose a valid next status")
                if not isinstance(note, str) or not 3 <= len(note.strip()) <= 240:
                    raise ValueError("Add a 3 to 240 character status note")
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with closing(connect_db()) as connection:
                    try:
                        connection.execute("BEGIN IMMEDIATE")
                        order = connection.execute("SELECT * FROM harvest_orders WHERE reference = ?", (reference,)).fetchone()
                        if order is None:
                            connection.rollback()
                            self._send_json(404, {"detail": "Order not found"})
                            return
                        if order["fulfillment_method"] == "delivery":
                            allowed = {"requested": {"accepted", "cancelled"}, "accepted": {"ready_for_delivery", "cancelled"}, "ready_for_delivery": {"out_for_delivery", "cancelled"}, "out_for_delivery": {"delivered", "delivery_failed"}, "delivery_failed": {"out_for_delivery", "cancelled"}}
                        else:
                            allowed = {"requested": {"accepted", "cancelled"}, "accepted": {"ready_for_pickup", "cancelled"}, "ready_for_pickup": {"completed", "cancelled"}}
                        if new_status not in allowed.get(order["status"], set()):
                            connection.rollback()
                            self._send_json(409, {"detail": f"Cannot move an order from {order['status']} to {new_status}"})
                            return
                        if new_status == "delivered":
                            supplied_code = payload.get("delivery_code")
                            supplied_hash = hashlib.sha256(f"{reference}:{supplied_code}".encode("utf-8")).hexdigest() if isinstance(supplied_code, str) else ""
                            if not hmac.compare_digest(supplied_hash, order["delivery_code_hash"]):
                                connection.rollback()
                                self._send_json(400, {"detail": "The customer handoff code does not match"})
                                return
                        if new_status == "delivery_failed" and len(note.strip()) < 3:
                            connection.rollback()
                            self._send_json(400, {"detail": "Add a note explaining the failed delivery"})
                            return
                        if new_status == "delivered":
                            connection.execute("UPDATE harvest_orders SET status = ?, updated_at = ?, proof_verified_at = ? WHERE reference = ?", (new_status, now, now, reference))
                        else:
                            connection.execute("UPDATE harvest_orders SET status = ?, updated_at = ? WHERE reference = ?", (new_status, now, reference))
                        connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?)", (reference, order["status"], new_status, note.strip(), now))
                        connection.commit()
                    except sqlite3.Error:
                        connection.rollback()
                        self._send_json(503, {"detail": "Could not update the order. Please retry."})
                        return
                self._record_operator_audit("order_status_changed", "order", reference, f"Status set to {new_status}")
                self._send_json(200, {"reference": reference, "status": new_status, "updated_at": now})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if request_path.startswith("/api/operator/support-tickets/") and request_path.endswith("/status"):
            if not self._operator_authorized():
                return
            ticket_id = request_path.removeprefix("/api/operator/support-tickets/").removesuffix("/status").strip("/").upper()
            try:
                payload = self._read_json()
                new_status = payload.get("status")
                note = payload.get("note")
                if not re.fullmatch(r"SUP-[0-9A-F]{16}", ticket_id):
                    raise ValueError("Choose a valid support ticket")
                if not isinstance(new_status, str) or new_status not in SUPPORT_STATUSES:
                    raise ValueError("Choose a valid support status")
                if not isinstance(note, str) or not 3 <= len(note.strip()) <= 500:
                    raise ValueError("Add a customer-facing update of 3 to 500 characters")
                allowed = {
                    "open": {"investigating", "awaiting_customer", "resolved", "closed"},
                    "investigating": {"awaiting_customer", "resolved", "closed"},
                    "awaiting_customer": {"investigating", "resolved", "closed"},
                    "resolved": {"investigating", "closed"},
                    "closed": {"investigating"},
                }
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with closing(connect_db()) as connection:
                    try:
                        connection.execute("BEGIN IMMEDIATE")
                        ticket = connection.execute("SELECT * FROM support_tickets WHERE id = ?", (ticket_id,)).fetchone()
                        if ticket is None:
                            connection.rollback()
                            self._send_json(404, {"detail": "Support ticket not found"})
                            return
                        if new_status not in allowed.get(ticket["status"], set()):
                            connection.rollback()
                            self._send_json(409, {"detail": f"Cannot move a ticket from {ticket['status']} to {new_status}"})
                            return
                        resolution_note = note.strip() if new_status == "resolved" else ticket["resolution_note"]
                        connection.execute("UPDATE support_tickets SET status = ?, resolution_note = ?, updated_at = ? WHERE id = ?", (new_status, resolution_note, now, ticket_id))
                        connection.execute("INSERT INTO support_ticket_events (ticket_id, from_status, to_status, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)", (ticket_id, ticket["status"], new_status, note.strip(), self.current_operator["full_name"], now))
                        connection.commit()
                    except sqlite3.Error:
                        connection.rollback()
                        self._send_json(503, {"detail": "Could not update the support request. Please retry."})
                        return
                self._record_operator_audit("support_ticket_updated", "support_ticket", ticket_id, f"Set support ticket status to {new_status}")
                self._send_json(200, {"ticket_id": ticket_id, "status": new_status, "updated_at": now})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if request_path.startswith("/api/operator/evidence/") and request_path.endswith("/decision"):
            if not self._operator_authorized():
                return
            evidence_id = request_path.removeprefix("/api/operator/evidence/").removesuffix("/decision").strip("/").upper()
            try:
                payload = self._read_json()
                decision = payload.get("decision")
                note = payload.get("note")
                if not re.fullmatch(r"EVD-[0-9A-F]{16}", evidence_id):
                    raise ValueError("Choose a valid evidence record")
                if not isinstance(decision, str) or decision not in {"approved", "declined"}:
                    raise ValueError("Choose approve or decline")
                if not isinstance(note, str) or not 3 <= len(note.strip()) <= 500:
                    raise ValueError("Add a 3 to 500 character review note")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    evidence = connection.execute("SELECT review_status FROM harvest_evidence WHERE id = ?", (evidence_id,)).fetchone()
                    if evidence is None:
                        connection.rollback()
                        self._send_json(404, {"detail": "Evidence record not found"})
                        return
                    if evidence["review_status"] == decision:
                        connection.rollback()
                        self._send_json(409, {"detail": f"This evidence is already {decision}"})
                        return
                    connection.execute(
                        "UPDATE harvest_evidence SET review_status = ?, review_note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?",
                        (decision, note.strip(), now, self.current_operator["full_name"], evidence_id),
                    )
                    connection.execute(
                        "INSERT INTO harvest_evidence_events (evidence_id, action, note, actor, actor_role, created_at) VALUES (?, ?, ?, ?, 'operator', ?)",
                        (evidence_id, decision, note.strip(), self.current_operator["full_name"], now),
                    )
                    connection.commit()
                except sqlite3.Error:
                    connection.rollback()
                    self._send_json(503, {"detail": "Could not save the evidence review. Please retry."})
                    return
            self._record_operator_audit(f"batch_evidence_{decision}", "harvest_evidence", evidence_id, note.strip())
            self._send_json(200, {"id": evidence_id, "review_status": decision, "reviewed_at": now})
            return
        if request_path.startswith("/api/operator/harvest-listings/") and request_path.endswith("/passport-events"):
            if not self._operator_authorized():
                return
            listing_id = request_path.removeprefix("/api/operator/harvest-listings/").removesuffix("/passport-events").strip("/").upper()
            try:
                payload = self._read_json()
                event_type = payload.get("event_type")
                location = payload.get("location", "")
                detail = payload.get("detail")
                if not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id):
                    raise ValueError("Choose a valid published batch")
                if not isinstance(event_type, str) or event_type not in {"harvested", "weighed", "graded", "packed", "handed_off"}:
                    raise ValueError("Choose a supported batch checkpoint")
                if not isinstance(location, str) or len(location.strip()) > 100:
                    raise ValueError("Location must be 100 characters or fewer")
                if not isinstance(detail, str) or not 3 <= len(detail.strip()) <= 240:
                    raise ValueError("Add a 3 to 240 character record note")
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                with closing(connect_db()) as connection, connection:
                    listing = connection.execute("SELECT id FROM harvest_listings WHERE id = ? AND status = 'published'", (listing_id,)).fetchone()
                    if listing is None:
                        self._send_json(404, {"detail": "Published batch not found"})
                        return
                    event_id = uuid.uuid4().hex
                    recorded_by = self.current_operator["full_name"]
                    connection.execute("INSERT INTO harvest_passport_events (id, listing_id, event_type, location, detail, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (event_id, listing_id, event_type, location.strip(), detail.strip(), recorded_by, now))
                self._record_operator_audit("passport_checkpoint_added", "harvest_listing", listing_id, f"Recorded {event_type} checkpoint")
                self._send_json(201, {"event": {"id": event_id, "listing_id": listing_id, "event_type": event_type, "location": location.strip(), "detail": detail.strip(), "recorded_by": recorded_by, "created_at": now}})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if request_path == "/api/harvest-listings":
            grower = self._grower_session()
            if grower is None:
                self._send_json(401, {"detail": "Sign in before submitting a harvest offer"})
                return
            try:
                payload = self._read_json()
                crop = payload.get("crop")
                category = payload.get("category")
                community = payload.get("community")
                quantity = payload.get("available_quantity")
                unit = payload.get("unit")
                harvest_window = payload.get("harvest_window")
                minimum_payout = payload.get("minimum_payout")
                if not isinstance(crop, str) or not 2 <= len(crop.strip()) <= 60:
                    raise ValueError("Crop name must be 2 to 60 characters")
                if not isinstance(category, str) or category not in PRODUCT_CATEGORIES:
                    raise ValueError("Choose fresh produce or grains, pulses, and oilseeds (staples)")
                if not isinstance(community, str) or community not in COMMUNITIES:
                    raise ValueError("Choose a supported pilot community")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100_000:
                    raise ValueError("Available quantity must be between 1 and 100000")
                if not isinstance(unit, str) or unit not in UNITS_BY_CATEGORY[category]:
                    raise ValueError("Choose a selling unit supported by this crop category")
                if not isinstance(harvest_window, str) or harvest_window not in {"Within 3 days", "Within 1 week", "Already harvested"}:
                    raise ValueError("Choose a harvest window")
                if isinstance(minimum_payout, bool) or not isinstance(minimum_payout, int) or not 1 <= minimum_payout <= 1_000_000:
                    raise ValueError("Minimum payout must be a positive rupee amount per unit")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            listing_id = f"VAV-{uuid.uuid4().hex[:10].upper()}"
            with closing(connect_db()) as connection, connection:
                connection.execute(
                    """INSERT INTO harvest_listings
                       (id, grower_id, crop, farm_name, community, available_quantity, unit, harvest_window, minimum_payout, category, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                    (listing_id, grower["id"], crop.strip(), grower["farm_name"], community, quantity, unit, harvest_window, minimum_payout, category, datetime.now(timezone.utc).isoformat(timespec="seconds")),
                )
                row = connection.execute("SELECT * FROM harvest_listings WHERE id = ?", (listing_id,)).fetchone()
            self._send_json(201, {"listing": self._listing_payload(row), "message": "Offer submitted for review. It is not public until the grower-approved terms are confirmed."})
            return
        if request_path.startswith("/api/operator/harvest-listings/") and request_path.endswith("/decision"):
            if not self._operator_authorized():
                return
            listing_id = request_path.removeprefix("/api/operator/harvest-listings/").removesuffix("/decision").strip("/")
            try:
                payload = self._read_json()
                decision = payload.get("decision")
                note = payload.get("note", "")
                if not isinstance(decision, str) or decision not in {"approve", "reject"}:
                    raise ValueError("Choose approve or reject")
                if not isinstance(note, str) or len(note) > 240:
                    raise ValueError("Review note must be 240 characters or fewer")
                with closing(connect_db()) as connection:
                    existing = connection.execute("SELECT * FROM harvest_listings WHERE id = ?", (listing_id,)).fetchone()
                if existing is None or existing["status"] != "pending":
                    self._send_json(404, {"detail": "Pending harvest offer not found"})
                    return
                if decision == "approve":
                    category = payload.get("category")
                    quantity = payload.get("approved_quantity")
                    grade = payload.get("grade")
                    grower_payout = payload.get("grower_payout")
                    packing_cost = payload.get("packing_cost")
                    platform_fee = payload.get("platform_fee")
                    route_cost = payload.get("route_cost")
                    values = [quantity, grower_payout, packing_cost, platform_fee, route_cost]
                    if any(isinstance(value, bool) or not isinstance(value, int) for value in values):
                        raise ValueError("Quantity and all price components must be whole rupee/integer amounts")
                    if not 1 <= quantity <= existing["available_quantity"]:
                        raise ValueError("Approved quantity must be within the grower's offered quantity")
                    if not isinstance(category, str) or category not in PRODUCT_CATEGORIES:
                        raise ValueError("Classify this offer as fresh produce or grains, pulses, and oilseeds (staples) before publishing")
                    if not isinstance(grade, str) or grade not in {"Grade A", "Grade B", "Mixed"}:
                        raise ValueError("Choose a supported grade")
                    if not existing["minimum_payout"] <= grower_payout <= 1_000_000:
                        raise ValueError("Grower payout must meet the submitted minimum and stay at or below ₹1,000,000 per unit")
                    if any(value < 0 or value > 1_000_000 for value in [packing_cost, platform_fee, route_cost]):
                        raise ValueError("Cost components must be between ₹0 and ₹1,000,000 per unit")
                    buyer_price = grower_payout + packing_cost + platform_fee + route_cost
                    status = "published"
                else:
                    if len(note.strip()) < 3:
                        raise ValueError("Add a short reason when declining an offer")
                    category = None
                    quantity = grade = grower_payout = packing_cost = platform_fee = route_cost = buyer_price = None
                    status = "rejected"
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            reviewed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection, connection:
                connection.execute(
                    """UPDATE harvest_listings SET status=?, category=COALESCE(?, category), approved_quantity=?, grade=?, grower_payout=?, packing_cost=?,
                       platform_fee=?, route_cost=?, buyer_price=?, decision_note=?, reviewed_at=? WHERE id=? AND status='pending'""",
                    (status, category, quantity, grade, grower_payout, packing_cost, platform_fee, route_cost, buyer_price, note.strip(), reviewed_at, listing_id),
                )
                row = connection.execute("SELECT * FROM harvest_listings WHERE id = ?", (listing_id,)).fetchone()
            self._record_operator_audit(f"offer_{status}", "harvest_listing", listing_id, f"Offer {status}")
            self._send_json(200, {"listing": self._listing_payload(row)})
            return
        if urlsplit(self.path).path == "/api/harvest-demand":
            try:
                payload = self._read_json()
                product_id = payload.get("product_id")
                community = payload.get("community")
                quantity = payload.get("quantity")
                if not isinstance(product_id, str) or product_id not in PRODUCTS:
                    raise ValueError("Choose a listed crop")
                if not isinstance(community, str) or community not in {"Mysuru", "Mandya", "Srirangapatna"}:
                    raise ValueError("Choose a supported pilot area")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity not in {1, 2, 3}:
                    raise ValueError("Choose 1, 2, or 3 household units")
                signal_id = uuid.uuid4().hex
                with closing(connect_db()) as connection, connection:
                    connection.execute(
                        "INSERT INTO harvest_demand (id, product_id, community, quantity, created_at) VALUES (?, ?, ?, ?, ?)",
                        (signal_id, product_id, community, quantity, datetime.now(timezone.utc).isoformat(timespec="seconds")),
                    )
                self._send_json(201, {"id": signal_id, "status": "recorded", "message": "Anonymous demand signal recorded. This is not an order."})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if urlsplit(self.path).path != "/api/demo/orders":
            self._send_json(404, {"detail": "API route not found"})
            return
        try:
            payload = self._read_json()
            items = payload.get("items")
            if not isinstance(items, list) or not items or len(items) > len(CATALOG):
                raise ValueError("Select at least one product")
            seen: set[str] = set()
            normalized: list[dict] = []
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError("Each order item must be an object")
                product_id = item.get("product_id")
                quantity = item.get("quantity")
                if not isinstance(product_id, str) or product_id not in PRODUCTS or product_id in seen:
                    raise ValueError("Product selection is invalid")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
                    raise ValueError("Quantity must be a positive whole number")
                product = PRODUCTS[product_id]
                if quantity > product["stock"]:
                    raise ValueError(f"Only {product['stock']} sample units are listed for {product['name']}")
                seen.add(product_id)
                normalized.append(
                    {
                        "product_id": product_id,
                        "name": product["name"],
                        "quantity": quantity,
                        "unit": product["unit"],
                        "unit_price": product["price"],
                        "line_total": product["price"] * quantity,
                    }
                )
        except ValueError as exc:
            self._send_json(400, {"detail": str(exc)})
            return

        farmer_total = sum(PRODUCTS[item["product_id"]]["received"] * item["quantity"] for item in normalized)
        packing_total = sum(PRODUCTS[item["product_id"]]["pack"] * item["quantity"] for item in normalized)
        platform_total = sum(PRODUCTS[item["product_id"]]["platform"] * item["quantity"] for item in normalized)
        subtotal = sum(item["line_total"] for item in normalized)
        order_total = subtotal + ROUTE_FEE
        reference = f"VAV-{datetime.now(timezone.utc):%y%m%d}-{uuid.uuid4().hex[:6].upper()}"
        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with closing(connect_db()) as connection, connection:
            connection.execute(
                """
                INSERT INTO demo_orders (
                    reference, created_at, status, payment_status, items_json,
                    farmer_total, packing_total, platform_total, route_fee, order_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reference,
                    created_at,
                    "demo_order_recorded",
                    "not_collected",
                    json.dumps(normalized, ensure_ascii=False),
                    farmer_total,
                    packing_total,
                    platform_total,
                    ROUTE_FEE,
                    order_total,
                ),
            )
            row = connection.execute("SELECT * FROM demo_orders WHERE reference = ?", (reference,)).fetchone()
        self._send_json(201, self._order_payload(row))

    @staticmethod
    def _order_payload(row: sqlite3.Row) -> dict:
        return {
            "reference": row["reference"],
            "created_at": row["created_at"],
            "status": row["status"],
            "payment_status": row["payment_status"],
            "mode": "demo",
            "items": json.loads(row["items_json"]),
            "price_breakdown": {
                "farmer_total": row["farmer_total"],
                "packing_total": row["packing_total"],
                "platform_total": row["platform_total"],
                "route_fee": row["route_fee"],
                "order_total": row["order_total"],
            },
            "message": "This record does not reserve real produce or collect payment.",
        }

    def _serve_static(self, path: str) -> None:
        if not STATIC_PATH.is_dir():
            self._send_json(503, {"detail": "Build the web app first or use the Vite development server"})
            return
        relative = unquote(path).lstrip("/") or "index.html"
        target = (STATIC_PATH / relative).resolve()
        if not target.is_relative_to(STATIC_PATH.resolve()):
            self._send_json(404, {"detail": "Not found"})
            return
        if not target.is_file():
            target = STATIC_PATH / "index.html"
        if not target.is_file():
            self._send_json(404, {"detail": "Not found"})
            return
        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self._headers(200, f"{content_type}; charset=utf-8" if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"} else content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        # Avoid query strings and request bodies in local server logs.
        status = args[1] if len(args) > 1 else "?"
        print(f"{self.command} {urlsplit(self.path).path}")


def main() -> None:
    host = os.environ.get("OriginalRoot_HOST", "127.0.0.1")
    port = int(os.environ.get("OriginalRoot_PORT", "8080"))
    with closing(connect_db()):
        pass
    print(f"OriginalRoot local API listening on http://{host}:{port} (online payments disabled)")
    ThreadingHTTPServer((host, port), OriginalRootHandler).serve_forever()


if __name__ == "__main__":
    main()

