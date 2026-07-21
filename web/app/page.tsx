import Link from "next/link";

const FEATURES = [
  {
    icon: "⚖️",
    title: "Legally clean",
    body: "Every XRPL address is screened against the official OFAC SDN sanctions list before FXRP can be minted. Fail-closed by design.",
  },
  {
    icon: "🔒",
    title: "Private by architecture",
    body: "Screening runs inside a confidential enclave. Only the verdict goes on-chain — never the client's transaction graph or identity.",
  },
  {
    icon: "⛓️",
    title: "Trustless verdicts",
    body: "~100 independent Flare Data Connector providers reach consensus on each verdict. Not even the operator can forge a result.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="text-center py-16">
        <p className="text-flare font-mono text-sm mb-4">
          CONFIDENTIAL COMPLIANCE FIREWALL · FLARE
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          Use your XRP on Flare.
          <br />
          <span className="text-slate-400">Legally. Privately.</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto mb-8">
          AegisFlow gates FXRP minting behind a confidential AML check: real
          sanctions data, enclave-side screening, and on-chain verdicts proven
          by the Flare Data Connector.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/verify" className="btn">
            Run a verification
          </Link>
          <Link
            href="/dashboard"
            className="border border-edge hover:border-slate-500 rounded-lg px-5 py-2.5 font-semibold transition"
          >
            Compliance dashboard
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5 mt-8">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-6">
            <div className="text-2xl mb-3">{f.icon}</div>
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 mt-10 font-mono text-xs text-slate-400 overflow-x-auto">
        <p className="text-slate-500 mb-3">// the pipeline</p>
        <pre>{`[ XRPL address ] ──► [ TEE verifier · OFAC SDN ] ──► [ FDC consensus ] ──► [ Gate contract ]
                       screening stays sealed        ~100 providers        allow / deny FXRP mint`}</pre>
      </section>
    </div>
  );
}
