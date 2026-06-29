const { join } = require('path');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const {
  NESTJS_IGNORED_WARNINGS,
  NESTJS_RESOLVE_ALIASES,
} = require('./webpack.shared');

// Watch + auto-restart dev config. NestJS DI/services cannot be hot-swapped via
// webpack HMR — a full process restart on each rebuild is the reliable path.
module.exports = {
  entry: {
    main: './src/main.ts',
  },
  target: 'node',
  devtool: 'inline-source-map',
  ignoreWarnings: NESTJS_IGNORED_WARNINGS,
  output: {
    path: join(__dirname, 'dist'),
    filename: '[name].js',
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            configFile: join(__dirname, 'tsconfig.app.json'),
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      ...NESTJS_RESOLVE_ALIASES,
    },
    plugins: [
      new TsconfigPathsPlugin({
        configFile: join(__dirname, 'tsconfig.app.json'),
      }),
    ],
  },
  plugins: [
    new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
    new RunScriptWebpackPlugin({ name: 'main.js', autoRestart: true }),
  ],
};
