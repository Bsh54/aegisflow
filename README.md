# AegisFlow

**Confidential AML compliance firewall for FXRP inflows on Flare.**

AegisFlow is a privacy-preserving compliance gate for institutions entering the
Flare ecosystem: every source wallet address is screened against multiple real
threat-intelligence lists (OFAC sanctions, FBI Lazarus Group, Israel NBCTF,
ransomware wallets) before FXRP can be minted — the screening runs inside a
confidential enclave, and the verdict is proven on-chain by the Flare Data
Connector, so no single party (including the operator) can forge a result.

Built for the **Flare Summer Signal** hackathon — Bounty 2, Confidential Compute.

**Live demo:** https://aegisflow.shadrakbessanh.me

---

## Problem

Institutions holding XRP face two blockers preventing them from using Flare DeFi:

1. **Legal** — AML/sanctions regulations forbid them from touching funds linked
   to sanctioned addresses. One mistake means fines or criminal liability.
2. **Privacy** — public blockchains expose everything. Running compliance
   checks in the open reveals clients, amounts, and screening logic to
   competitors and front-runners.

AegisFlow removes both blockers at once: institutional-grade screening,
sealed inside trusted hardware, enforced trustlessly on-chain.

## Architecture

```
┌────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐
│  Web app   │───►│  TEE verifier     │───►│  Flare Data       │───►│  Gate contract │
│  (Next.js) │    │  (Intel TDX /     │    │  Connector (FDC)  │    │  (Coston2)     │
│            │    │   Phala dstack)   │    │  provider consensus│   │                │
└────────────┘    └──────────────────┘    └──────────────────┘    └───────────────┘
   UI + proxy       OFAC SDN screening      Web2Json attestation     verifies proof,
   w/ failover      sealed in enclave       Merkle consensus         gates FXRP mint
```

**Data flow for one verification:**

1. A user (or institution back-office) submits an XRPL address.
2. The **verifier** — a FastAPI service running inside a Phala Cloud
   confidential VM (Intel TDX, dstack) — screens it against several public
   threat lists (refreshed hourly, fail-closed on the required OFAC list) and
   exposes a deterministic `GET /attest/<address>` endpoint returning only
   `{address, verdict}`. Raw evidence never leaves the enclave.
3. An **FDC Web2Json attestation** is requested: independent Flare data
   providers each fetch the endpoint, reach consensus, and the round produces a
   Merkle proof retrievable from the DA layer.
4. **`AegisFlowGate`** (Solidity) verifies the proof via
   `ContractRegistry.getFdcVerification().verifyWeb2Json`, checks the attested
   URL is pinned to the AegisFlow verifier, decodes the verdict, and records it.
   `authorizeMint` then allows or denies the FXRP mint accordingly.

**Verdicts:** `1 CLEAR` (mint allowed) · `2 REVIEW` (fail-closed hold) ·
`3 BLOCKED` (OFAC match, denied).

**High availability:** the web app proxies verifier endpoints TEE-first with
automatic failover to a standby node (same code, same dataset), so the service
stays up even when the enclave is powered down between demo windows.

## Deployed components

| Component | Location |
|---|---|
| Web app + API proxy | https://aegisflow.shadrakbessanh.me |
| Gate contract (Coston2) | [`0x0C27183591F69fF97Cc6dD1c019D2388352D69CA`](https://coston2-explorer.flare.network/address/0x0C27183591F69fF97Cc6dD1c019D2388352D69CA) |
| Compliant FXRP gateway (real FXRP) | `0x84DA55ef31a7a6ceFFDaB9A226cd2c2D1bA6FE73` |
| ERC-3643 compliance module | `0x838d5DE18e315bE7111420bDAa090a2260673e8c` |
| TEE verifier | Phala Cloud CVM (Intel TDX, dstack) — bootstraps `tee/app.py` from this repo |
| Enclave (verifiable) | app id `8498ab9f2f973abd475e9948aa51c8fdc3674848` · reachable at `https://8498ab9f2f973abd475e9948aa51c8fdc3674848-8000.dstack-pha-prod5.phala.network/health` · attest with `phala cvms attestation 8498ab9f2f973abd475e9948aa51c8fdc3674848` |
| Threat data | OFAC SDN (XRP), FBI Lazarus, Israel NBCTF, Ransomwhere — all public, hourly refresh |

> Note: the enclave is powered on for demo and the judging window (Aug 13–22);
> outside that window the app auto-fails over to a standby verifier (same code,
> same data) so the site stays up. The direct enclave URL only responds while
> the CVM is running.

## Threat intelligence sources

Screening runs against several independent, public lists — all fetched and
refreshed hourly inside the enclave:

| List | Jurisdiction | Coverage | Policy |
|---|---|---|---|
| **OFAC SDN (XRP)** | 🇺🇸 US Treasury | Sanctioned XRP addresses | Required · dual-channel cross-check · fail-closed |
| **FBI Lazarus Group** | 🇺🇸 US FBI | North-Korean state hacker wallets | Best-effort (via OpenSanctions) |
| **Israel NBCTF** | 🇮🇱 Israel | Terror-financing wallets | Best-effort (via OpenSanctions) |
| **Ransomwhere** | 🌍 Global | Known ransomware payment wallets | Best-effort (via OpenSanctions) |

Any address matching *any* list yields `BLOCKED`. If the required OFAC list
cannot be loaded, screening fails closed (`REVIEW`) — never an automatic allow.
The live lists are browsable at `/sanctions` and via the verifier's
`GET /sanctions` endpoint.

## Repository layout

```
aegisflow/
├── contracts/           # Solidity + Hardhat
│   ├── contracts/AegisFlowGate.sol    # compliance gate w/ FDC proof verification
│   ├── scripts/deploy.ts              # Coston2 deployment
│   ├── scripts/fdcAttest.ts           # full FDC attestation pipeline
│   └── test/                          # unit tests
├── tee/                 # confidential verifier
│   ├── app.py                         # FastAPI service (OFAC screening)
│   ├── Dockerfile / docker-compose.yml
│   └── phala-compose.yml              # Phala CVM deployment (code from GitHub)
├── connector/           # Node/ethers glue (dev path: verifier → contract)
└── web/                 # Next.js 14 app
    ├── app/                           # landing, /verify, /dashboard + API proxy routes
    ├── components/                    # icons (SVG), live status/metrics
    ├── lib/                           # contract bindings, TEE-failover proxy
    └── DESIGN.md                      # design system specification
```

## Running it yourself

### Prerequisites

- Node.js ≥ 20, Python ≥ 3.12
- A funded Coston2 test wallet ([faucet](https://faucet.flare.network/coston2))

### 1. Contracts

```bash
cd contracts
npm install
cp .env.example .env          # set PRIVATE_KEY (test wallet only)
npx hardhat test              # unit tests (gate, gateway, ERC-3643 module)
npx hardhat run scripts/deploy.ts --network coston2
```

### 2. Verifier

```bash
cd tee
python -m venv .venv && .venv/bin/pip install -r requirements.txt
MOCK_MODE=false .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8200
# or: docker compose up --build
```

Endpoints: `GET /health` · `POST /screen {"xrpl_address": "r..."}` ·
`GET /attest/<address>` (deterministic, consumed by the FDC).

### 3. FDC attestation (trustless verdict)

```bash
cd contracts
GATE_ADDRESS=0x... XRPL_ADDRESS=r... \
npx hardhat run scripts/fdcAttest.ts --network coston2
```

The script prepares the Web2Json request on the testnet verifier, pays and
submits it to `FdcHub`, waits for round finalization, fetches the Merkle proof
from the DA layer, and submits it to the gate. `REUSE_ROUND_ID=<id>` skips
payment/wait for an already-finalized round.

### 4. TEE deployment (Phala Cloud)

```bash
npx phala auth login <api-token>
npx phala deploy --name aegisflow --compose ./tee/phala-compose.yml \
  --instance-type tdx.small --wait
npx phala cvms attestation <cvm-id>     # remote attestation certificate chain
```

The CVM pulls `tee/app.py` directly from this public repository at boot — what
runs inside the enclave is exactly what you can audit here.

### 5. Web app

```bash
cd web
npm install
npm run build && npm run start          # serves on :8300
```

Environment: `TEE_VERIFIER_URL` (enclave), `LOCAL_VERIFIER_URL` (fallback),
`NEXT_PUBLIC_GATE_ADDRESS`, `NEXT_PUBLIC_RPC_URL`.

## FAssets integration path

FAssets v1.3 introduced **direct minting**: a single XRPL payment to the FXRP
Core Vault, after which an **executor** relays the payment proof to Flare and
the mint completes. v1.3 also added mint-side controls — executor restrictions,
hourly/daily caps, delays on large mints, and a governance unblocking path.

AegisFlow slots into that exact architecture as **the executor's compliance
layer**: before relaying a payment proof, the executor queries
`AegisFlowGate.isCompliant(keccak256(sourceAddress))`. A sanctioned source
means the proof is never relayed and the mint never happens — enforced by an
FDC-proven verdict rather than an operator's promise. Because CLEAR verdicts
expire after 24 hours, compliance is continuously re-proven as sanctions lists
evolve.

This makes AegisFlow complementary to the protocol's built-in caps and delays:
FAssets rate-limits *how much* can be minted; AegisFlow governs *who* may mint.

## Security model

- **Fail-closed:** any screening uncertainty (API error, missing data) yields
  `REVIEW`, never an automatic allow.
- **URL pinning:** the gate rejects FDC proofs whose attested URL differs from
  `attestBaseUrl + address` — proofs for other APIs cannot be replayed.
- **Determinism:** `/attest` carries no timestamps or volatile fields, so
  independent FDC providers converge on identical responses.
- **Enclave privacy:** only the verdict and an evidence hash leave the TEE;
  the transaction graph and screening details stay sealed.
- **No trusted operator:** with the FDC path, verdicts are accepted only with
  a valid Merkle consensus proof; the legacy attestor path exists for local
  development and is flagged on-chain (`fdcVerified=false`).

## Tech stack

Solidity 0.8.25 · `@flarenetwork/flare-periphery-contracts` · Hardhat ·
ethers v6 · FastAPI · Phala Cloud (dstack, Intel TDX) · Next.js 14 ·
Tailwind CSS · Flare Coston2 (FDC Web2Json, FdcHub, DA layer)

## License

MIT
