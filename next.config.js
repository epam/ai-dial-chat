const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  reactStrictMode: true,

  webpack(config, { isServer, dev }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },

  images: {
    remotePatterns: [
      {
        hostname: '*',
      },
    ],
  },
  publicRuntimeConfig: {
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: `${
                process.env.ALLOWED_IFRAME_ORIGINS
                  ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
                  : 'frame-ancestors none'
              }`,
            },
          ],
        },
      ];
    },
  },
};

module.exports = nextConfig;
