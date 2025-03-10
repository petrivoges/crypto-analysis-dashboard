/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // GitHub Pages serves content from a subdirectory when using project pages
  // If you're using a custom domain, you can remove this line
  basePath: "/crypto-analysis-dashboard",
  // Disable server-side features for static export
  trailingSlash: true,
}

module.exports = nextConfig

