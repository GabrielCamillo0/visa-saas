/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "*"] },
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "@react-pdf/renderer"],
  },
};
export default nextConfig;