#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
NON_DIGIT_RE = re.compile(r"\D+")
HK_PHONE_LENGTHS = {8, 11, 12}
DEFAULT_COLLECTION = "crm_contacts"


@dataclass(frozen=True)
class ImportCandidate:
    document_id: str
    payload: dict


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Filter CRM-ready contacts from a CSV and optionally import them into Firestore."
    )
    parser.add_argument("csv_path", type=Path, help="Path to the source CSV file.")
    parser.add_argument(
        "--collection",
        default=DEFAULT_COLLECTION,
        help=f"Firestore collection to write into. Default: {DEFAULT_COLLECTION}.",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        help=(
            "Path to a Firebase service account JSON file. "
            "Defaults to GOOGLE_APPLICATION_CREDENTIALS when omitted."
        ),
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=400,
        help="Firestore batch size for writes. Default: 400.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only process the first N rows after the header. Default: all rows.",
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=20,
        help="How many accepted records to print during dry run. Default: 20.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write accepted records to Firestore. Without this flag the script stays in dry-run mode.",
    )
    return parser.parse_args()


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""

    text = value.strip()
    if text.upper() == "NULL":
        return ""
    return text


def normalize_email(value: str | None) -> str:
    return normalize_text(value).lower()


def normalize_phone(value: str | None) -> str:
    digits = NON_DIGIT_RE.sub("", normalize_text(value))
    if digits.startswith("852") and len(digits) > 8:
        return digits
    if len(digits) == 8:
        return f"852{digits}"
    return digits


def is_valid_email(email: str) -> bool:
    return bool(email) and bool(EMAIL_RE.match(email))


def is_valid_phone(phone: str) -> bool:
    if not phone:
        return False
    return len(phone) in HK_PHONE_LENGTHS


def build_address(address: str, detail_address: str) -> str:
    parts = [part for part in (normalize_text(address), normalize_text(detail_address)) if part]
    return ", ".join(parts)


def build_document_id(source_id: str, email: str, phone: str, area: str) -> str:
    if source_id:
        return f"cfu_{source_id}"

    digest_source = "|".join([email, phone, area])
    digest = hashlib.sha1(digest_source.encode("utf-8")).hexdigest()[:20]
    return f"cfu_{digest}"


def build_candidate(row: dict[str, str]) -> tuple[ImportCandidate | None, str | None]:
    source_id = normalize_text(row.get("id"))
    email = normalize_email(row.get("email"))
    phone = normalize_phone(row.get("mobile") or row.get("tel"))
    area = normalize_text(row.get("area"))
    address = build_address(row.get("address", ""), row.get("detail_address", ""))

    has_valid_email = is_valid_email(email)
    has_valid_phone = is_valid_phone(phone)

    if not has_valid_email and not has_valid_phone:
        return None, "missing_valid_email_or_phone"

    payload = {
        "source": "cfumaster_csv",
        "sourceUserId": source_id or None,
        "name": normalize_text(row.get("name")) or None,
        "email": email or None,
        "phone": phone or None,
        "address": address or None,
        "district": area or None,
        "marketingConsent": "unknown",
        "channels": {
            "email": has_valid_email,
            "sms": has_valid_phone,
            "phone": has_valid_phone,
        },
        "raw": {
            "mobile": normalize_text(row.get("mobile")),
            "tel": normalize_text(row.get("tel")),
            "website": normalize_text(row.get("website")),
            "facebook": normalize_text(row.get("facebook")),
            "usertype": normalize_text(row.get("usertype")),
        },
    }

    document_id = build_document_id(source_id, email, phone, area)
    return ImportCandidate(document_id=document_id, payload=payload), None


def load_candidates(csv_path: Path, limit: int) -> tuple[list[ImportCandidate], Counter[str], int]:
    accepted: list[ImportCandidate] = []
    skipped = Counter()
    processed = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if limit and processed >= limit:
                break

            processed += 1
            candidate, reason = build_candidate(row)
            if candidate is None:
                skipped[reason or "unknown"] += 1
                continue

            accepted.append(candidate)

    return accepted, skipped, processed


def print_preview(candidates: Iterable[ImportCandidate], preview: int) -> None:
    for index, candidate in enumerate(candidates, start=1):
        if index > preview:
            break

        print(f"[{index}] {candidate.document_id}")
        print(json.dumps(candidate.payload, ensure_ascii=False, indent=2))


def resolve_credentials_path(cli_credentials: Path | None) -> Path:
    if cli_credentials is not None:
        return cli_credentials.expanduser().resolve()

    env_credentials = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if env_credentials:
        return Path(env_credentials).expanduser().resolve()

    raise SystemExit(
        "Firebase credentials are required for --apply. "
        "Pass --credentials or set GOOGLE_APPLICATION_CREDENTIALS."
    )


def get_firestore_client(credentials_path: Path):
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError as exc:
        raise SystemExit(
            "firebase-admin is required for --apply. Install it with `python3 -m pip install firebase-admin`."
        ) from exc

    if not credentials_path.exists():
        raise SystemExit(f"Credentials file not found: {credentials_path}")

    firebase_admin.initialize_app(credentials.Certificate(str(credentials_path)))
    return firestore.client()


def write_to_firestore(candidates: list[ImportCandidate], collection: str, credentials_path: Path, batch_size: int) -> None:
    if batch_size <= 0:
        raise SystemExit("--batch-size must be greater than 0.")

    client = get_firestore_client(credentials_path)
    total = len(candidates)
    written = 0
    batch = client.batch()
    batch_count = 0

    for candidate in candidates:
        doc_ref = client.collection(collection).document(candidate.document_id)
        batch.set(doc_ref, candidate.payload, merge=True)
        batch_count += 1

        if batch_count >= batch_size:
            batch.commit()
            written += batch_count
            print(f"Committed {written}/{total} records...")
            batch = client.batch()
            batch_count = 0

    if batch_count:
        batch.commit()
        written += batch_count

    print(f"Committed {written} records into Firestore collection '{collection}'.")


def main() -> int:
    args = parse_args()
    csv_path: Path = args.csv_path.expanduser().resolve()

    if not csv_path.exists():
        raise SystemExit(f"CSV file not found: {csv_path}")

    candidates, skipped, processed = load_candidates(csv_path, args.limit)

    print(f"Processed rows: {processed}")
    print(f"Accepted rows: {len(candidates)}")
    print("Skipped rows by reason:")
    for reason, count in sorted(skipped.items()):
        print(f"  - {reason}: {count}")

    if not args.apply:
        print("\nDry run mode: no records were written to Firebase.")
        if candidates:
            print_preview(candidates, args.preview)
        return 0

    credentials_path = resolve_credentials_path(args.credentials)
    write_to_firestore(
        candidates=candidates,
        collection=args.collection,
        credentials_path=credentials_path,
        batch_size=args.batch_size,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())