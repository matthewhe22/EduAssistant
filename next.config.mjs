/** @type {import('next').NextConfig} */
const nextConfig = {
  // Curriculum JSON is read from disk by server components.
  experimental: {
    outputFileTracingIncludes: { "/**": ["./data/curriculum/**/*"] },
    // pptxgenjs and jszip use Node built-ins; load them from node_modules instead of bundling.
    serverComponentsExternalPackages: ["pptxgenjs", "jszip"],
  },
};
export default nextConfig;
