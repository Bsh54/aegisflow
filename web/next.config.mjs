/** @type {import('next').NextConfig} */
const VERIFIER = process.env.VERIFIER_INTERNAL_URL ?? "http://127.0.0.1:8200";

const nextConfig = {
  async rewrites() {
    // The public hostname serves this app; verifier endpoints are proxied
    // through so the FDC-pinned /attest URL keeps working unchanged.
    return [
      { source: "/attest/:path*", destination: `${VERIFIER}/attest/:path*` },
      { source: "/screen", destination: `${VERIFIER}/screen` },
      { source: "/health", destination: `${VERIFIER}/health` },
    ];
  },
};

export default nextConfig;
