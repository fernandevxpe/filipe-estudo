/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Evita empacotar o binário nativo de forma incorreta nas funções Node da Vercel
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
