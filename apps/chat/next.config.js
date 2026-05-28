// @ts-check

const fs = require('fs');
const path = require('path');
const { i18n } = require('./next-i18next.config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

if (!process.env.THEMES_CONFIG_HOST && process.env.NODE_ENV !== 'development') {
  console.warn('\x1b[33mwarn\x1b[0m  - THEMES_CONFIG_HOST is not provided. Using fallback themes.');
  console.warn('\x1b[33m     \x1b[0m  - Set THEMES_CONFIG_HOST in your environment for production themes.');
}

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
    return this.valueOf().startsWith(str);
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
    return this.valueOf().endsWith(str);
  }

  toJSON() {
    return this.toString();
  }
}

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  reactCompiler: false,
  devIndicators: false,
  nx: {},
  productionBrowserSourceMaps: process.env.NODE_ENV !== 'production',

  i18n,
  poweredByHeader: false,
  reactStrictMode: true,
  // @ts-ignore
  basePath:
    process.env.NODE_ENV !== 'development' ? new BasePathResolver() : '',

  async redirects() {
    return [
      {
        source: '/marketplace/share/:slug([^/]+)',
        destination: '/marketplace/?share=:slug',
        permanent: false,
      },
      {
        source: '/share/:slug([^/]+)',
        destination: '/?share=:slug',
        permanent: false,
      },
      {
        source: '/models/:slug([^/]+)',
        destination: '/?isolated-model-id=:slug',
        permanent: false,
      },
      // Support old two route app editor links
      {
        source: '/apps-editor/:slug/settings',
        has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
        destination: '/apps-editor?step=General&schema=:slug&id=:id',
        permanent: false,
      },
      {
        source: '/apps-editor/:slug',
        has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
        destination: '/apps-editor?step=General&schema=:slug&id=:id',
        permanent: false,
      },
      {
        source: '/apps-editor/:slug',
        destination: '/apps-editor?step=General&schema=:slug',
        permanent: false,
      },
    ];
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      // Copy pdfjs worker to public/ so it's served locally instead of falling
      // back to an external CDN (which is blocked by script-src CSP).
      const workerSrc = path.join(
        __dirname,
        '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      );
      if (fs.existsSync(workerSrc)) {
        fs.copyFileSync(
          workerSrc,
          path.join(__dirname, 'public/pdf.worker.min.mjs'),
        );
      }
    }

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
    const fileLoaderRule = config.module.rules.find(
      (/** @type {{ test: { test: (arg0: string) => any; }; }} */ rule) =>
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

    config.resolve.alias = {
      ...config.resolve.alias,
      'micromark-extension-math': 'micromark-extension-llm-math',
      '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css': path.join(
        __dirname,
        '../../node_modules/@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css',
      ),
    };

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /protobufjs[\\/]src[\\/]util[\\/]inquire\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

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
