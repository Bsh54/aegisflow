"""
AegisFlow — Confidential AML verifier.

Runs inside a TEE (Phala confidential VM). Receives a wallet address, screens
it against multiple real threat-intelligence lists, and returns a *verdict*
only — the raw screening data never leaves the enclave.

Threat lists (all public, refreshed hourly, fail-closed on the required one):
  - OFAC SDN (XRP)      — US Treasury sanctions, dual-channel cross-checked
  - FBI Lazarus Group   — North Korean state hacker wallets (via OpenSanctions)
  - Israel NBCTF        — terror-financing wallets (via OpenSanctions)
  - Ransomwhere         — known ransomware payment wallets (via OpenSanctions)
"""
from __future__ import annotations

import csv
import hashlib
import io
import os
import time
from enum import IntEnum

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AegisFlow AML Verifier", version="0.3.0")

MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"
LIST_TTL = int(os.getenv("LIST_TTL", "3600"))  # refresh lists at most hourly

MOCK_BLACKLIST = {"rSanctionedBadActorExample1111111111"}

OPENSANCTIONS_BASE = "https://data.opensanctions.org/datasets/latest"

# Each list: id, human name, jurisdiction, fetch spec, and whether the whole
# screening must fail closed when this list cannot be loaded.
THREAT_LISTS = [
    {
        "id": "OFAC-SDN-XRP",
        "name": "US Treasury OFAC SDN (XRP)",
        "jurisdiction": "United States",
        "kind": "plain",  # newline-separated addresses
        "urls": [
            "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_XRP.txt",
            "https://cdn.jsdelivr.net/gh/0xB10C/ofac-sanctioned-digital-currency-addresses@lists/sanctioned_addresses_XRP.txt",
        ],
        "cross_check": True,
        "required": True,
        "source_url": "https://ofac.treasury.gov/",
    },
    {
        "id": "FBI-LAZARUS",
        "name": "US FBI Lazarus Group wallets",
        "jurisdiction": "United States",
        "kind": "opensanctions",
        "urls": [f"{OPENSANCTIONS_BASE}/us_fbi_lazarus_crypto/targets.simple.csv"],
        "cross_check": False,
        "required": False,
        "source_url": "https://www.opensanctions.org/datasets/us_fbi_lazarus_crypto/",
    },
    {
        "id": "IL-NBCTF",
        "name": "Israel NBCTF sanctioned wallets",
        "jurisdiction": "Israel",
        "kind": "opensanctions",
        "urls": [f"{OPENSANCTIONS_BASE}/il_mod_crypto/targets.simple.csv"],
        "cross_check": False,
        "required": False,
        "source_url": "https://www.opensanctions.org/datasets/il_mod_crypto/",
    },
    {
        "id": "RANSOMWHERE",
        "name": "Ransomwhere ransomware wallets",
        "jurisdiction": "Global",
        "kind": "opensanctions",
        "urls": [f"{OPENSANCTIONS_BASE}/ransomwhere/targets.simple.csv"],
        "cross_check": False,
        "required": False,
        "source_url": "https://www.opensanctions.org/datasets/ransomwhere/",
    },
]

# per-list cache: id -> {"addresses": set, "fetched_at": float, "error": str|None}
_cache: dict[str, dict] = {}


class Verdict(IntEnum):
    UNKNOWN = 0
    CLEAR = 1
    REVIEW = 2
    BLOCKED = 3


class ScreenRequest(BaseModel):
    xrpl_address: str


class ScreenResponse(BaseModel):
    xrpl_address_hash: str
    verdict: int
    verdict_label: str
    matched_list: str | None
    evidence_hash: str
    source: str
    timestamp: int


def _address_hash(addr: str) -> str:
    return "0x" + hashlib.sha3_256(addr.encode()).hexdigest()


def _evidence_hash(payload: str) -> str:
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


def _parse_plain(text: str) -> set[str]:
    return {
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.startswith("#")
    }


def _parse_opensanctions(text: str) -> set[str]:
    """Extract CryptoWallet addresses from an OpenSanctions simple CSV."""
    out: set[str] = set()
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        if row.get("schema") == "CryptoWallet":
            name = (row.get("name") or "").strip()
            if name:
                out.add(name)
    return out


async def _fetch_list(client: httpx.AsyncClient, spec: dict) -> None:
    """Fetch one list into the cache; on error keep stale data + note error."""
    entry = _cache.setdefault(spec["id"], {"addresses": set(), "fetched_at": 0.0, "error": None})
    if entry["addresses"] and (time.time() - entry["fetched_at"] < LIST_TTL):
        return
    try:
        texts = []
        for url in spec["urls"]:
            resp = await client.get(url)
            resp.raise_for_status()
            texts.append(resp.text)
        parse = _parse_plain if spec["kind"] == "plain" else _parse_opensanctions
        parsed = [parse(t) for t in texts]
        if spec["cross_check"] and any(p != parsed[0] for p in parsed[1:]):
            raise RuntimeError("distribution channels disagree — failing closed")
        entry["addresses"] = parsed[0]
        entry["fetched_at"] = time.time()
        entry["error"] = None
    except Exception as e:  # keep stale data if any; record the failure
        entry["error"] = str(e)
        if spec["required"] and not entry["addresses"]:
            raise


async def _refresh_lists() -> None:
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        for spec in THREAT_LISTS:
            await _fetch_list(client, spec)


async def _screen_address(addr: str) -> tuple[Verdict, str | None, str]:
    """Return (verdict, matched_list_id, raw_evidence)."""
    if MOCK_MODE:
        if addr in MOCK_BLACKLIST:
            return Verdict.BLOCKED, "MOCK", f"mock: {addr} on mock list"
        return Verdict.CLEAR, None, f"mock: {addr} not listed"

    try:
        await _refresh_lists()
    except Exception as e:
        # required list unavailable => fail closed, never auto-allow
        return Verdict.REVIEW, None, f"required list unavailable: {e}"

    for spec in THREAT_LISTS:
        entry = _cache.get(spec["id"], {})
        if addr in entry.get("addresses", set()):
            return Verdict.BLOCKED, spec["id"], f"match in {spec['id']} for {addr}"

    total = sum(len(_cache.get(s["id"], {}).get("addresses", set())) for s in THREAT_LISTS)
    return Verdict.CLEAR, None, f"{addr} not found in {total} listed wallets"


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "source": "mock" if MOCK_MODE else "multi-list",
        "lists": len(THREAT_LISTS),
    }


@app.get("/sanctions")
async def sanctions() -> dict:
    """The live threat-intelligence lists this verifier screens against."""
    if MOCK_MODE:
        return {"total": len(MOCK_BLACKLIST), "lists": [
            {"id": "MOCK", "name": "Mock list", "count": len(MOCK_BLACKLIST),
             "addresses_sample": sorted(MOCK_BLACKLIST), "status": "ok"}
        ]}
    try:
        await _refresh_lists()
    except Exception:
        pass
    lists = []
    total = 0
    for spec in THREAT_LISTS:
        entry = _cache.get(spec["id"], {})
        addrs = sorted(entry.get("addresses", set()))
        total += len(addrs)
        lists.append({
            "id": spec["id"],
            "name": spec["name"],
            "jurisdiction": spec["jurisdiction"],
            "count": len(addrs),
            "addresses_sample": addrs[:100],
            "status": "error" if entry.get("error") else "ok",
            "error": entry.get("error"),
            "required": spec["required"],
            "source_url": spec["source_url"],
            "refreshed_at": int(entry.get("fetched_at", 0)),
        })
    return {"total": total, "lists": lists}


@app.get("/attest/{xrpl_address}")
async def attest(xrpl_address: str) -> dict:
    """Deterministic endpoint consumed by the FDC (Web2Json attestation).

    ~100 independent FDC data providers each fetch this URL and must obtain the
    exact same JSON, so the response carries no timestamp or volatile fields.
    """
    verdict, _matched, _raw = await _screen_address(xrpl_address)
    return {"address": xrpl_address, "verdict": int(verdict)}


@app.post("/screen", response_model=ScreenResponse)
async def screen(req: ScreenRequest) -> ScreenResponse:
    verdict, matched, raw_evidence = await _screen_address(req.xrpl_address)
    return ScreenResponse(
        xrpl_address_hash=_address_hash(req.xrpl_address),
        verdict=int(verdict),
        verdict_label=verdict.name,
        matched_list=matched,
        evidence_hash=_evidence_hash(raw_evidence),  # only the hash is public
        source="mock" if MOCK_MODE else "multi-list",
        timestamp=int(time.time()),
    )
