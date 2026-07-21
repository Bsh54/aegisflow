# AegisFlow — Web frontend

Next.js + Tailwind + wagmi frontend. Deploys to Vercel.

Planned screens:

1. **Landing** — the pitch ("Use your XRP on Flare, legally and privately").
2. **Verify** — connect wallet / paste XRPL address → live screening animation →
   verdict (✅ CLEAR / ⚠️ REVIEW / ❌ BLOCKED). The hero screen for judges.
3. **Dashboard** — institution view: list of screenings, allowed/blocked counters.
4. **Proof detail** — the FDC attestation + TEE signature for one screening.

## Scaffold (to run once)

```bash
cd web
npx create-next-app@latest . --ts --tailwind --app --eslint
npm install wagmi viem @tanstack/react-query
```

The verify page calls the TEE verifier (`/screen`) and then reads/writes the
`AegisFlowGate` contract on Coston2 via wagmi.

> Not scaffolded yet — this is Step 1's frontend placeholder. See root roadmap.
