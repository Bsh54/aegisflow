# AegisFlow — TEE AML Verifier

Confidential AML screening service. Runs as a Docker container locally (Step 2)
and inside a Phala confidential VM (Step 3).

## Run locally (mock mode — no API key needed)

```bash
cd tee
docker compose up --build
```

Then test:

```bash
# Clean address -> verdict 1 (CLEAR)
curl -X POST http://localhost:8000/screen \
  -H "Content-Type: application/json" \
  -d '{"xrpl_address": "rCleanAddressExample"}'

# Blacklisted address -> verdict 3 (BLOCKED)
curl -X POST http://localhost:8000/screen \
  -H "Content-Type: application/json" \
  -d '{"xrpl_address": "rSanctionedBadActorExample1111111111"}'
```

## Verdict codes

| Code | Label   | Meaning                        |
|------|---------|--------------------------------|
| 0    | UNKNOWN | never screened                 |
| 1    | CLEAR   | low risk — allowed             |
| 2    | REVIEW  | medium risk — manual review    |
| 3    | BLOCKED | sanctioned / high risk — denied|

## Privacy

Only the **verdict** and a **hash** of the audit evidence are returned. The raw
screening data (transaction graph, matches) never leaves the enclave.

## Deploy to Phala (Step 3)

Bring this `docker-compose.yml` to Phala Cloud, deploy it as a Confidential VM,
and export the remote-attestation report from the dashboard for on-chain
verification (Automata DCAP verifier). See project root README for the roadmap.
