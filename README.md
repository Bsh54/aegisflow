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
[ Web app ]  ──►  [ TEE verifier ]  ──►  [ FDC ]  ──►  [ Gate contract ]
 (React)          (private AML check)     (notary)      (allow / deny mint)
                        │
                        ▼
                 [ AML API: Chainalysis / TRM ]
```

1. A user requests to mint FXRP from an XRPL address.
2. The **TEE verifier** (running in a Phala confidential VM) queries an AML API
   and produces a **signed verdict** — the raw data never leaves the enclave.
3. The **FDC** (Flare Data Connector) certifies the verdict on-chain, trustlessly.
4. The **Gate contract** on Flare reads the certified verdict and allows or blocks
   the mint, keeping a private audit proof.

## Tech stack

| Layer | Tech | Hosting |
|-------|------|---------|
| Frontend | React / Next.js + Tailwind + wagmi | Vercel |
| TEE verifier | Python + Docker | Phala Cloud (dstack) |
| Notary | Flare Data Connector (Web2Json) | Flare Coston2 |
| Gate contract | Solidity + Hardhat | Flare Coston2 |
| AML data | Chainalysis / TRM free sanctions API | external |

## Repository layout

```
aegisflow/
├── contracts/   # Solidity gate contract + Hardhat setup
├── tee/         # Python AML verifier + Dockerfile (runs in Phala TEE)
└── web/         # Next.js frontend
```

## Build roadmap

- [ ] **Step 1** — Skeleton: gate contract on Coston2 + basic web page (hardcoded verdict)
- [ ] **Step 2** — Real AML check (verifier calls Chainalysis/TRM, off-enclave)
- [ ] **Step 3** — Move verifier into the Phala TEE
- [ ] **Step 4** — Wire FDC attestation so the gate trusts the verdict trustlessly
- [ ] **Step 5** — Polish UI (3-level verdict), demo video, submission writeup

## Status

🚧 Early development — hackathon project. Deadline: **August 14, 2026**.

## License

MIT
