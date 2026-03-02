/** @type {import('next').NextConfig} */
const nextConfig = {
    /* config options here */
    transpilePackages: ['react-plotly.js', 'plotly.js-dist-min'],
    turbopack: {} // Silencia o erro sobre webpack config ausente em Turbopack
};

export default nextConfig;
