const { join } = require('path');
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const {
  NESTJS_IGNORED_WARNINGS,
  NESTJS_RESOLVE_ALIASES,
} = require('./webpack.shared');

module.exports = {
  ignoreWarnings: NESTJS_IGNORED_WARNINGS,
  resolve: {
    alias: NESTJS_RESOLVE_ALIASES,
  },
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
    }),
  ],
};
