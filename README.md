# 🛡️ AegisFlow

**Confidential AML compliance firewall for FXRP inflows on Flare.**

AegisFlow is a privacy-preserving compliance gate that lets institutions accept
FXRP without breaking AML/sanctions law — and **without** exposing their clients'
transaction graph on the public ledger.

Built for the **Flare Summer Signal** hackathon (Bounty 2 — Confidential Compute).

---

## The problem

Banks and funds want to use their idle XRP on Flare, but face two blockers:

1. **Legal**: they are legally forbidden from touching funds linked to sanctioned
   or criminal addresses.
2. **Privacy**: everything on a public blockchain is visible — running compliance
   checks in the open would expose their clients, amounts, and screening logic.

Result: institutions stay out. AegisFlow removes that blocker.

## How it works

```
[ Web app ]──►[ TEE verifier ]──►[ FDC (~100 providers) ]──►[ Gate contract ]
 (React)      real OFAC SDN        Web2Json attestation      allow / deny mint
              screening            Merkle-proof consensus    (Coston2)
```

1. A user requests to mint FXRP from an XRPL address.
2. The **verifier** (TEE service) screens the address against the **official
   OFAC SDN sanctions list** (real data, fail-closed) and exposes a
   deterministic `/attest/<address>` endpoint returning only the verdict.
3. The **FDC** (Flare Data Connector): ~100 independent data providers each
   fetch that endpoint, reach consensus, and produce a **Merkle proof** — no
   single party (not even us) can forge a verdict.
4. The **AegisFlowGate** contract verifies the FDC proof on-chain
   (`verifyWeb2Json`), pins the attested URL to our verifier, stores the
   verdict, and allows or blocks the FXRP mint accordingly.

### Verdicts

| Code | Label   | Meaning                          |
|------|---------|----------------------------------|
| 1    | CLEAR   | not sanctioned — mint allowed    |
| 2    | REVIEW  | uncertainty — fail-closed, held  |
| 3    | BLOCKED | OFAC SDN match — mint denied     |

## Live deployment

| Piece | Where |
|-------|-------|
| Verifier API | https://aegisflow.shadrakbessanh.me (`/health`, `/screen`, `/attest/<addr>`) |
| Gate contract (Coston2) | `0x7d7F06AFd4C178b07E4cE69085d6f79721Cca797` |
| Sanctions data | Official OFAC SDN digital-currency list (XRP), refreshed hourly |

## Tech stack

| Layer | Tech |
|-------|------|
| Gate contract | Solidity 0.8.25 + Flare periphery (`ContractRegistry`, `IWeb2Json`) |
| Attestation | FDC Web2Json on Coston2 (verifier + FdcHub + DA layer) |
| Verifier | Python FastAPI, Docker-ready for Phala TEE (dstack) |
| Connector | Node.js + ethers v6 |
| Frontend | Next.js + wagmi (in progress) |

## Repository layout

```
aegisflow/
├── contracts/   # AegisFlowGate + Hardhat, tests, deploy & FDC attestation scripts
├── tee/         # AML verifier (FastAPI) + Dockerfile for Phala confidential VM
├── connector/   # verifier -> on-chain glue (dev/attestor path)
└── web/         # Next.js frontend
```

## Running the FDC attestation

```bash
cd contracts
GATE_ADDRESS=0x7d7F06AFd4C178b07E4cE69085d6f79721Cca797 \
XRPL_ADDRESS=<address-to-screen> \
npx hardhat run scripts/fdcAttest.ts --network coston2
```

## Build roadmap

- [x] Gate contract on Coston2 + tests
- [x] Real OFAC sanctions screening (mock removed)
- [x] Public verifier deployment (cloudflared)
- [x] Trustless FDC Web2Json verdict path
- [ ] Verifier inside Phala TEE (confidential compute) + remote attestation
- [ ] Web UI (verify / dashboard / proof screens)
- [ ] FAssets AssetManager integration for the actual FXRP mint

## License

MIT
