"use client";

import { useEffect, useState } from "react";
import { gate } from "@/lib/contract";

interface Health {
  status: string;
  source: string;
  verifier?: string;
}

export function LiveStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [verifier, setVerifier] = useState<string>("");

  useEffect(() => {
    fetch("/health")
      .then(async (r) => {
        setVerifier(r.headers.get("x-aegis-verifier") ?? "");
        setHealth(await r.json());
      })
      .catch(() => setHealth({ status: "offline", source: "-" }));
  }, []);

  const up = health?.status === "ok";

  return (
    <div className="card p-6 font-mono text-sm" aria-label="Live system status">
      <div className="flex items-center justify-between mb-5">
        <span className="text-mutedfg text-xs tracking-widest">LIVE STATUS</span>
        <span className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${up ? "bg-clear" : "bg-blocked"} ${up ? "animate-pulse" : ""}`}
          />
          {health ? (up ? "operational" : "offline") : "checking…"}
        </span>
      </div>
      <div className="space-y-3">
        <Row k="verifier" v={health ? (verifier === "tee" ? "Intel TDX enclave" : "standby node") : undefined} />
        <Row k="sanctions data" v={health?.source} />
        <Row k="attestation" v={health ? "FDC · Web2Json" : undefined} />
        <Row k="network" v={health ? "Flare Coston2" : undefined} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-edge/60 pb-2.5 last:border-0">
      <span className="text-mutedfg">{k}</span>
      {v ? <span className="text-fg">{v}</span> : <span className="skeleton w-24 h-4 inline-block" />}
    </div>
  );
}

export function LiveMetrics() {
  const [m, setM] = useState<{ total: number; cleared: number; blocked: number; fdc: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const g = gate();
        const events = await g.queryFilter(g.filters.Screened(), -50000);
        const rows = events.map((e: any) => ({
          verdict: Number(e.args[1]),
          fdc: Boolean(e.args[4]),
        }));
        setM({
          total: rows.length,
          cleared: rows.filter((r) => r.verdict === 1).length,
          blocked: rows.filter((r) => r.verdict === 3).length,
          fdc: rows.filter((r) => r.fdc).length,
        });
      } catch {
        setM({ total: 0, cleared: 0, blocked: 0, fdc: 0 });
      }
    })();
  }, []);

  const items = [
    { label: "screenings on-chain", value: m?.total, cls: "text-fg" },
    { label: "cleared", value: m?.cleared, cls: "text-clear" },
    { label: "blocked", value: m?.blocked, cls: "text-blocked" },
    { label: "FDC-verified", value: m?.fdc, cls: "text-gold" },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-5" aria-label="Live metrics">
      {items.map((it) => (
        <div key={it.label} className="card p-6 text-center">
          {it.value === undefined ? (
            <div className="skeleton h-9 w-12 mx-auto mb-1" />
          ) : (
            <p className={`text-3xl font-bold ${it.cls}`}>{it.value}</p>
          )}
          <p className="text-xs text-mutedfg mt-1">{it.label}</p>
        </div>
      ))}
    </section>
  );
}
