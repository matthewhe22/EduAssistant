/** @type {import('next').NextConfig} */
const nextConfig = {
  // Curriculum JSON is read from disk by server components.
  experimental: { outputFileTracingIncludes: { "/**": ["./data/curriculum/**/*"] } },
};
export default nextConfig;
