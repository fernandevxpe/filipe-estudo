/** @type {import('next').NextConfig} */
const nextConfig = {
  // Na Vercel o lint por vezes falha por PATH/env diferente do local — não bloqueia o deploy
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Browsers pedem /favicon.ico por defeito; só temos favicon.svg em public/
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: false },
    ];
  },
  experimental: {
    // Evita empacotar o binário nativo de forma incorreta nas funções Node da Vercel
    serverComponentsExternalPackages: ["better-sqlite3"],
    // Reforço: pastas grandes não usadas em runtime (sync-repo-data já as remove do build)
    outputFileTracingExcludes: {
      "*": [
        "./data/processed/enem/**/*",
        "./data/processed/ssa/**/*",
        // Figuras em produção vêm de public/data/assets (CDN); não empacotar ~266MB em cada lambda
        "./data/assets/**/*",
      ],
    },
  },
};

export default nextConfig;
