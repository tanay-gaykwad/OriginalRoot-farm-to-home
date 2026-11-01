"""Local OriginalRoot API for harvest offers, pickup requests, and sample data."""

from __future__ import annotations

import json
import hmac
import mimetypes
import os
import re
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src" / "catalog.json"
STATIC_PATH = ROOT / "dist"
DATA_PATH = Path(os.environ.get("OriginalRoot_DB_PATH", ROOT / ".data" / "OriginalRoot.sqlite3"))
ROUTE_FEE = 24
MAX_BODY_BYTES = 16_384
OPERATOR_TOKEN = os.environ.get("OriginalRoot_OPERATOR_TOKEN", "")
COMMUNITIES = {"Mysuru", "Mandya", "Srirangapatna"}
UNITS = {"kg", "500 g", "250 g", "bunch", "dozen"}


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

    def _send_json(self, status: int, payload: object) -> None:
        body = json_bytes(payload)
        self._headers(status)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("Invalid request length") from exc
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("Request body must be between 1 and 16384 bytes")
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Request body must be valid JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object")
        return payload

    def _operator_authorized(self) -> bool:
        if not OPERATOR_TOKEN:
            self._send_json(503, {"detail": "Operator access is not configured on this server"})
            return False
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {OPERATOR_TOKEN}"
        if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
            self._send_json(401, {"detail": "Operator key is missing or invalid"})
            return False
        return True

    @staticmethod
    def _listing_payload(row: sqlite3.Row) -> dict:
        return {key: row[key] for key in row.keys()}

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send_json(200, {"status": "ok", "mode": "local-pilot", "operator_review_enabled": bool(OPERATOR_TOKEN), "order_requests_enabled": bool(OPERATOR_TOKEN), "payments_enabled": False})
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
                latest = connection.execute("SELECT note FROM harvest_order_events WHERE order_reference = ? ORDER BY id DESC LIMIT 1", (reference,)).fetchone()
            if row is None:
                self._send_json(404, {"detail": "Order reference not found"})
                return
            self._send_json(200, {"reference": row["reference"], "crop": row["crop"], "quantity": row["quantity"], "unit": row["unit"], "total": row["total"], "status": row["status"], "latest_note": latest["note"] if latest else "", "created_at": row["created_at"], "updated_at": row["updated_at"]})
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
            if row is None:
                self._send_json(404, {"detail": "Order reference not found"})
                return
            self._send_json(200, {"reference": row["reference"], "crop": row["crop"], "quantity": row["quantity"], "unit": row["unit"], "total": row["total"], "status": row["status"], "created_at": row["created_at"], "updated_at": row["updated_at"]})
            return
        if path == "/api/harvest-listings":
            params = dict(part.split("=", 1) for part in urlsplit(self.path).query.split("&") if "=" in part)
            if params.get("scope") == "review":
                if not self._operator_authorized():
                    return
                query = "SELECT * FROM harvest_listings WHERE status = 'pending' ORDER BY created_at"
            else:
                query = "SELECT * FROM harvest_listings WHERE status = 'published' ORDER BY created_at DESC"
            with closing(connect_db()) as connection:
                rows = connection.execute(query).fetchall()
                public_keys = ("id", "crop", "farm_name", "community", "approved_quantity", "unit", "harvest_window", "grade", "grower_payout", "packing_cost", "platform_fee", "route_cost", "buyer_price", "reviewed_at")
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
        if request_path == "/api/orders":
            if not OPERATOR_TOKEN:
                self._send_json(503, {"detail": "Order requests are disabled until a local operator key is configured"})
                return
            try:
                payload = self._read_json()
                listing_id = payload.get("listing_id")
                customer_name = payload.get("customer_name")
                customer_phone = payload.get("customer_phone")
                community = payload.get("community")
                quantity = payload.get("quantity")
                if not isinstance(listing_id, str) or not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id):
                    raise ValueError("Choose a current OriginalRoot harvest offer")
                if not isinstance(customer_name, str) or not 2 <= len(customer_name.strip()) <= 80:
                    raise ValueError("Name must be 2 to 80 characters")
                if not isinstance(customer_phone, str) or not re.fullmatch(r"[6-9][0-9]{9}", customer_phone):
                    raise ValueError("Enter a valid 10-digit Indian mobile number")
                if not isinstance(community, str) or community not in COMMUNITIES:
                    raise ValueError("Choose a supported pickup community")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100:
                    raise ValueError("Quantity must be between 1 and 100 units")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            reference = f"VAV-{uuid.uuid4().hex[:16].upper()}"
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    listing = connection.execute("SELECT * FROM harvest_listings WHERE id = ? AND status = 'published'", (listing_id,)).fetchone()
                    if listing is None or listing["community"] != community:
                        connection.rollback()
                        self._send_json(404, {"detail": "That harvest is no longer available in this community"})
                        return
                    reserved = connection.execute("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM harvest_orders WHERE listing_id = ? AND status != 'cancelled'", (listing_id,)).fetchone()["quantity"]
                    if quantity > listing["approved_quantity"] - reserved:
                        connection.rollback()
                        self._send_json(409, {"detail": "There is not enough unreserved quantity in this harvest"})
                        return
                    total = listing["buyer_price"] * quantity
                    connection.execute(
                        """INSERT INTO harvest_orders (reference, listing_id, crop, farm_name, customer_name, customer_phone, community, quantity, unit, grower_payout, packing_cost, platform_fee, route_cost, total, status, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)""",
                        (reference, listing_id, listing["crop"], listing["farm_name"], customer_name.strip(), customer_phone, community, quantity, listing["unit"], listing["grower_payout"] * quantity, listing["packing_cost"] * quantity, listing["platform_fee"] * quantity, listing["route_cost"] * quantity, total, now, now),
                    )
                    connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, NULL, 'requested', 'Customer requested a pickup order; payment not collected', ?)", (reference, now))
                    connection.commit()
                except sqlite3.Error:
                    connection.rollback()
                    self._send_json(503, {"detail": "Could not record the order. Please try again."})
                    return
            self._send_json(201, {"reference": reference, "status": "requested", "crop": listing["crop"], "quantity": quantity, "unit": listing["unit"], "total": total, "message": "Order request recorded. Wait for operator confirmation before pickup; no payment was collected."})
            return
        if request_path.startswith("/api/operator/orders/") and request_path.endswith("/status"):
            if not self._operator_authorized():
                return
            reference = request_path.removeprefix("/api/operator/orders/").removesuffix("/status").strip("/").upper()
            try:
                payload = self._read_json()
                new_status = payload.get("status")
                note = payload.get("note", "")
                allowed = {"requested": {"accepted", "cancelled"}, "accepted": {"ready_for_pickup", "cancelled"}, "ready_for_pickup": {"completed", "cancelled"}}
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
                        if new_status not in allowed.get(order["status"], set()):
                            connection.rollback()
                            self._send_json(409, {"detail": f"Cannot move an order from {order['status']} to {new_status}"})
                            return
                        connection.execute("UPDATE harvest_orders SET status = ?, updated_at = ? WHERE reference = ?", (new_status, now, reference))
                        connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?)", (reference, order["status"], new_status, note.strip(), now))
                        connection.commit()
                    except sqlite3.Error:
                        connection.rollback()
                        self._send_json(503, {"detail": "Could not update the order. Please retry."})
                        return
                self._send_json(200, {"reference": reference, "status": new_status, "updated_at": now})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if request_path == "/api/orders":
            try:
                payload = self._read_json()
                listing_id = payload.get("listing_id")
                customer_name = payload.get("customer_name")
                customer_phone = payload.get("customer_phone")
                community = payload.get("community")
                quantity = payload.get("quantity")
                if not isinstance(listing_id, str) or not re.fullmatch(r"VAV-[0-9A-F]{10}", listing_id):
                    raise ValueError("Choose a current OriginalRoot harvest offer")
                if not isinstance(customer_name, str) or not 2 <= len(customer_name.strip()) <= 80:
                    raise ValueError("Name must be 2 to 80 characters")
                if not isinstance(customer_phone, str) or not re.fullmatch(r"[6-9][0-9]{9}", customer_phone):
                    raise ValueError("Enter a valid 10-digit Indian mobile number")
                if not isinstance(community, str) or community not in COMMUNITIES:
                    raise ValueError("Choose a supported pickup community")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100:
                    raise ValueError("Quantity must be between 1 and 100 units")
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            reference = f"VAV-{uuid.uuid4().hex[:16].upper()}"
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection:
                try:
                    connection.execute("BEGIN IMMEDIATE")
                    listing = connection.execute("SELECT * FROM harvest_listings WHERE id = ? AND status = 'published'", (listing_id,)).fetchone()
                    if listing is None or listing["community"] != community:
                        connection.rollback()
                        self._send_json(404, {"detail": "That harvest is no longer available in this community"})
                        return
                    reserved = connection.execute("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM harvest_orders WHERE listing_id = ? AND status != 'cancelled'", (listing_id,)).fetchone()["quantity"]
                    if quantity > listing["approved_quantity"] - reserved:
                        connection.rollback()
                        self._send_json(409, {"detail": "There is not enough unreserved quantity in this harvest"})
                        return
                    total = listing["buyer_price"] * quantity
                    connection.execute(
                        """INSERT INTO harvest_orders (reference, listing_id, crop, farm_name, customer_name, customer_phone, community, quantity, unit, grower_payout, packing_cost, platform_fee, route_cost, total, status, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)""",
                        (reference, listing_id, listing["crop"], listing["farm_name"], customer_name.strip(), customer_phone, community, quantity, listing["unit"], listing["grower_payout"] * quantity, listing["packing_cost"] * quantity, listing["platform_fee"] * quantity, listing["route_cost"] * quantity, total, now, now),
                    )
                    connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, NULL, 'requested', 'Customer requested a pickup order; payment not collected', ?)", (reference, now))
                    connection.commit()
                except sqlite3.Error:
                    connection.rollback()
                    self._send_json(503, {"detail": "Could not record the order. Please try again."})
                    return
            self._send_json(201, {"reference": reference, "status": "requested", "crop": listing["crop"], "quantity": quantity, "unit": listing["unit"], "total": total, "message": "Order request recorded. Wait for operator confirmation before pickup; no payment was collected."})
            return
        if request_path.startswith("/api/operator/orders/") and request_path.endswith("/status"):
            if not self._operator_authorized():
                return
            reference = request_path.removeprefix("/api/operator/orders/").removesuffix("/status").strip("/").upper()
            try:
                payload = self._read_json()
                new_status = payload.get("status")
                note = payload.get("note", "")
                allowed = {"requested": {"accepted", "cancelled"}, "accepted": {"ready_for_pickup", "cancelled"}, "ready_for_pickup": {"completed", "cancelled"}}
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
                        if new_status not in allowed.get(order["status"], set()):
                            connection.rollback()
                            self._send_json(409, {"detail": f"Cannot move an order from {order['status']} to {new_status}"})
                            return
                        connection.execute("UPDATE harvest_orders SET status = ?, updated_at = ? WHERE reference = ?", (new_status, now, reference))
                        connection.execute("INSERT INTO harvest_order_events (order_reference, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?)", (reference, order["status"], new_status, note.strip(), now))
                        connection.commit()
                    except sqlite3.Error:
                        connection.rollback()
                        self._send_json(503, {"detail": "Could not update the order. Please retry."})
                        return
                self._send_json(200, {"reference": reference, "status": new_status, "updated_at": now})
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
            return
        if request_path == "/api/harvest-listings":
            try:
                payload = self._read_json()
                crop = payload.get("crop")
                farm_name = payload.get("farm_name")
                community = payload.get("community")
                quantity = payload.get("available_quantity")
                unit = payload.get("unit")
                harvest_window = payload.get("harvest_window")
                minimum_payout = payload.get("minimum_payout")
                if not isinstance(crop, str) or not 2 <= len(crop.strip()) <= 60:
                    raise ValueError("Crop name must be 2 to 60 characters")
                if not isinstance(farm_name, str) or not 2 <= len(farm_name.strip()) <= 80:
                    raise ValueError("Farm or collective name must be 2 to 80 characters")
                if not isinstance(community, str) or community not in COMMUNITIES:
                    raise ValueError("Choose a supported pilot community")
                if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100_000:
                    raise ValueError("Available quantity must be between 1 and 100000")
                if not isinstance(unit, str) or unit not in UNITS:
                    raise ValueError("Choose a supported selling unit")
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
                       (id, crop, farm_name, community, available_quantity, unit, harvest_window, minimum_payout, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                    (listing_id, crop.strip(), farm_name.strip(), community, quantity, unit, harvest_window, minimum_payout, datetime.now(timezone.utc).isoformat(timespec="seconds")),
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
                    quantity = grade = grower_payout = packing_cost = platform_fee = route_cost = buyer_price = None
                    status = "rejected"
            except ValueError as exc:
                self._send_json(400, {"detail": str(exc)})
                return
            reviewed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            with closing(connect_db()) as connection, connection:
                connection.execute(
                    """UPDATE harvest_listings SET status=?, approved_quantity=?, grade=?, grower_payout=?, packing_cost=?,
                       platform_fee=?, route_cost=?, buyer_price=?, decision_note=?, reviewed_at=? WHERE id=? AND status='pending'""",
                    (status, quantity, grade, grower_payout, packing_cost, platform_fee, route_cost, buyer_price, note.strip(), reviewed_at, listing_id),
                )
                row = connection.execute("SELECT * FROM harvest_listings WHERE id = ?", (listing_id,)).fetchone()
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


if __name__ == "__main__":
    host = os.environ.get("OriginalRoot_HOST", "127.0.0.1")
    port = int(os.environ.get("OriginalRoot_PORT", "8080"))
    with closing(connect_db()):
        pass
    print(f"OriginalRoot local API listening on http://{host}:{port} (online payments disabled)")
    ThreadingHTTPServer((host, port), OriginalRootHandler).serve_forever()

