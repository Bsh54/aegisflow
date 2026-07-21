"""
AegisFlow — Confidential AML verifier.

This service runs inside a TEE (Phala confidential VM). It receives an XRPL
address, screens it against an AML / sanctions API, and returns a *verdict*
only — the raw screening data never leaves the enclave.

Roadmap:
  Step 2: runs here in the clear, calling a real (or mocked) AML API.
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

app = FastAPI(title="AegisFlow AML Verifier", version="0.1.0")

# AML provider endpoint. Defaults to a public sanctions screening API.
# Chainalysis offers a free sanctions screening API; TRM offers one too.
AML_API_URL = os.getenv(
    "AML_API_URL",
    "https://public.chainalysis.com/api/v1/address/",
)
AML_API_KEY = os.getenv("AML_API_KEY", "")

# Mock mode lets us build the whole pipeline before wiring a real API key.
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"

# A tiny hardcoded blacklist for local/demo testing in mock mode.
MOCK_BLACKLIST = {
    "rSanctionedBadActorExample1111111111",
}


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
    timestamp: int


def _address_hash(addr: str) -> str:
    """keccak-like id used on-chain. Uses keccak256 to match Solidity."""
    # NOTE: Solidity keccak256(bytes). We use sha3_256 stand-in here; swap to
    # a real keccak lib (pysha3 / eth-utils) before wiring to the contract.
    return "0x" + hashlib.sha3_256(addr.encode()).hexdigest()


def _evidence_hash(payload: str) -> str:
    """Hash of the sealed audit report kept private inside the enclave."""
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


async def _screen_address(addr: str) -> tuple[Verdict, str]:
    """Return (verdict, raw_evidence). Raw evidence never leaves the enclave."""
    if MOCK_MODE:
        if addr in MOCK_BLACKLIST:
            return Verdict.BLOCKED, f"mock: {addr} on sanctions list"
        return Verdict.CLEAR, f"mock: {addr} not found on any sanctions list"

    headers = {"X-API-Key": AML_API_KEY} if AML_API_KEY else {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{AML_API_URL}{addr}", headers=headers)

    # fail-closed: any uncertainty => block rather than risk letting bad funds in.
    if resp.status_code != 200:
        return Verdict.REVIEW, f"aml api status {resp.status_code}"

    data = resp.json()
    identifications = data.get("identifications", [])
    if identifications:
        return Verdict.BLOCKED, f"sanctioned: {identifications}"
    return Verdict.CLEAR, "no sanctions match"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mock_mode": MOCK_MODE}


@app.post("/screen", response_model=ScreenResponse)
async def screen(req: ScreenRequest) -> ScreenResponse:
    verdict, raw_evidence = await _screen_address(req.xrpl_address)
    return ScreenResponse(
        xrpl_address_hash=_address_hash(req.xrpl_address),
        verdict=int(verdict),
        verdict_label=verdict.name,
        evidence_hash=_evidence_hash(raw_evidence),  # only the hash is public
        timestamp=int(time.time()),
    )
