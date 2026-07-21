import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Github } from "@/components/icons";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisFlow — Confidential Compliance for FXRP",
  description:
    "Privacy-preserving AML firewall for FXRP inflows on Flare. Real OFAC data, FDC-verified verdicts, TEE confidentiality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="ambient">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-flare focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
        >
          Skip to content
        </a>
        <nav className="sticky top-0 z-40 border-b border-edge bg-base/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-lg cursor-pointer transition duration-200 hover:opacity-80"
            >
              <span className="text-flare">
                <Shield className="w-6 h-6" />
              </span>
              AegisFlow
            </Link>
            <div className="flex items-center gap-2 md:gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-mutedfg hover:text-fg transition duration-200 px-3 py-2 rounded-lg hover:bg-surface cursor-pointer"
              >
                Dashboard
              </Link>
              <Link
                href="/proof"
                className="text-mutedfg hover:text-fg transition duration-200 px-3 py-2 rounded-lg hover:bg-surface cursor-pointer"
              >
                Proof
              </Link>
              <a
                href="https://github.com/Bsh54/aegisflow"
                target="_blank"
                aria-label="GitHub repository"
                className="text-mutedfg hover:text-fg transition duration-200 p-2 rounded-lg hover:bg-surface cursor-pointer"
              >
                <Github />
              </a>
              <Link href="/verify" className="btn !py-2 !min-h-[40px] text-sm">
                Run verification
              </Link>
            </div>
          </div>
        </nav>
        <main id="main" className="max-w-6xl mx-auto px-6 py-12">
          {children}
        </main>
        <footer className="border-t border-edge mt-20">
          <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-mutedfg flex flex-col md:flex-row gap-2 justify-between">
            <span>AegisFlow — Flare Summer Signal 2026</span>
            <span className="font-mono">Coston2 testnet · OFAC SDN data · FDC verified · TEE sealed</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
