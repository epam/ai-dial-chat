const { withNx } = require('@nx/next');
const { i18n } = require('./next-i18next.config');

class BasePathResolver {
  [Symbol.toPrimitive](hint) {
    if (hint === 'string') {
      return this.toString();
    }
    if (hint === 'number') {
      return NaN;
    }
    return this.valueOf();
  }

  get length() {
    return this.valueOf().length;
  }

  valueOf() {
    return process.env.APP_BASE_PATH || '';
  }

  toString() {
    return this.valueOf() || '';
  }

  startsWith(str) {
    return this.valueOf().startsWith(str)
  }

  replace(...args) {
    return this.valueOf().replace(...args);
  }

  endsWith(str) {
    return this.valueOf().endsWith(str)
  }

  toJSON() {
    return this.toString();
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = withNx({
  i18n,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  basePath: new BasePathResolver(),

  async redirects() {
    return [
      {
        source: '/share/:slug([A-Za-z0-9-]+)',
        destination: '/?share=:slug',
        permanent: false,
      },
    ];
  },

  webpack(config, options) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    //SVGR config
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: { not: /url/ }, // exclude if *.svg?url
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              replaceAttrValues: {
                '#000': 'currentColor',
              },
              typescript: true,
              dimensions: false,
            },
          },
        ],
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },

  images: {
    remotePatterns: [
      {
        hostname: '*',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/overlay/script.js',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
});

module.exports = nextConfig;
