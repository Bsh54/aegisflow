"""
AegisFlow — Confidential AML verifier.

Runs inside a TEE (Phala confidential VM). Receives an XRPL address, screens it
against the official OFAC sanctions list, and returns a *verdict* only — the raw
screening data never leaves the enclave.

Data source (real mode): the official OFAC SDN "Digital Currency Address" list
for XRP, published in the open (no API key needed). Set MOCK_MODE=false to use it.

Roadmap:
  Step 2: runs here in the clear, screening against the real OFAC list.
  Step 3: same code, packaged into the Phala TEE via the Dockerfile.
  Step 4: the signed verdict is submitted on-chain through the FDC.
"""
from __future__ import annotations

import hashlib
import os
import time
from enum import IntEnum

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AegisFlow AML Verifier", version="0.2.0")

# Official OFAC sanctioned XRP addresses (open mirror of the US Treasury SDN list).
OFAC_LIST_URL = os.getenv(
    "OFAC_LIST_URL",
    "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_XRP.txt",
)
LIST_TTL = int(os.getenv("LIST_TTL", "3600"))  # refresh the list at most hourly

# Mock mode lets us build the pipeline without any network dependency.
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"

MOCK_BLACKLIST = {"rSanctionedBadActorExample1111111111"}

# in-memory cache of the sanctions list
_cache: dict = {"addresses": set(), "fetched_at": 0.0}


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
    evidence_hash: str
    source: str
    timestamp: int


def _address_hash(addr: str) -> str:
    return "0x" + hashlib.sha3_256(addr.encode()).hexdigest()


def _evidence_hash(payload: str) -> str:
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


async def _load_ofac_list() -> set[str]:
    """Fetch & cache the OFAC sanctioned XRP address list."""
    now = time.time()
    if _cache["addresses"] and (now - _cache["fetched_at"] < LIST_TTL):
        return _cache["addresses"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OFAC_LIST_URL)
    resp.raise_for_status()
    addrs = {
        line.strip()
        for line in resp.text.splitlines()
        if line.strip() and not line.startswith("#")
    }
    _cache["addresses"] = addrs
    _cache["fetched_at"] = now
    return addrs


async def _screen_address(addr: str) -> tuple[Verdict, str, str]:
    """Return (verdict, raw_evidence, source). Raw evidence stays in the enclave."""
    if MOCK_MODE:
        source = "mock"
        if addr in MOCK_BLACKLIST:
            return Verdict.BLOCKED, f"mock: {addr} on sanctions list", source
        return Verdict.CLEAR, f"mock: {addr} not sanctioned", source

    source = "OFAC-SDN-XRP"
    try:
        sanctioned = await _load_ofac_list()
    except Exception as e:  # fail-closed: uncertainty => require review, never auto-allow
        return Verdict.REVIEW, f"ofac list fetch failed: {e}", source

    if addr in sanctioned:
        return Verdict.BLOCKED, f"OFAC SDN match for {addr}", source
    return Verdict.CLEAR, f"{addr} not on OFAC SDN (list size {len(sanctioned)})", source


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mock_mode": MOCK_MODE, "source": "mock" if MOCK_MODE else "OFAC-SDN-XRP"}


@app.get("/attest/{xrpl_address}")
async def attest(xrpl_address: str) -> dict:
    """Deterministic endpoint consumed by the FDC (Web2Json attestation).

    ~100 independent FDC data providers each fetch this URL and must obtain the
    exact same JSON, so the response carries no timestamp or volatile fields.
    """
    verdict, _raw, _source = await _screen_address(xrpl_address)
    return {"address": xrpl_address, "verdict": int(verdict)}


@app.post("/screen", response_model=ScreenResponse)
async def screen(req: ScreenRequest) -> ScreenResponse:
    verdict, raw_evidence, source = await _screen_address(req.xrpl_address)
    return ScreenResponse(
        xrpl_address_hash=_address_hash(req.xrpl_address),
        verdict=int(verdict),
        verdict_label=verdict.name,
        evidence_hash=_evidence_hash(raw_evidence),  # only the hash is public
        source=source,
        timestamp=int(time.time()),
    )
