//@ts-check

const { i18n } = require('./next-i18next.config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

class BasePathResolver {
  /**
   * @param {'string' | 'number' | unknown} hint
   */
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

  /**
   * @param {string} str
   */
  startsWith(str) {
    return this.valueOf().startsWith(str)
  }

  /**
   * @param {any[]} args
   */
  replace(...args) {
    // @ts-ignore
    return this.valueOf().replace(...args);
  }

  /**
   * @param {string} str
   */
  endsWith(str) {
    return this.valueOf().endsWith(str)
  }

  toJSON() {
    return this.toString();
  }
}

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  productionBrowserSourceMaps: process.env.NODE_ENV !== 'production',

  i18n,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  // @ts-ignore
  basePath: new BasePathResolver(),

  async redirects() {
    return [
      {
        source: '/share/:slug([A-Za-z0-9-]+)',
        destination: '/?share=:slug',
        permanent: false,
      },
      {
        source: '/models/:slug([A-Za-z0-9@.:-]+)',
        destination: '/?isolated-model-id=:slug',
        permanent: false,
      },
    ];
  },

  webpack(config, { isServer }) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    if (!isServer) {
      config.output.environment = {
        ...config.output.environment,
        asyncFunction: true,
        module: true,
      };
    }

    //SVGR config
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((/** @type {{ test: { test: (arg0: string) => any; }; }} */ rule) =>
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

};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
