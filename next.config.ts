import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a TODA resposta (defesa em profundidade):
// anti-clickjacking (o app nunca precisa ser enquadrado), anti MIME-sniffing,
// vazamento mínimo de referer e HSTS. Uma CSP completa exigiria nonce nos
// scripts inline do App Router — fica como evolução futura; aqui travamos ao
// menos `frame-ancestors`.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Não anuncia o framework (X-Powered-By) — reduz fingerprinting.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Escudos/bandeiras servidos pela Football-Data.org
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
