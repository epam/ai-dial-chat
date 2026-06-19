const { join } = require('path');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const {
  NESTJS_IGNORED_WARNINGS,
  NESTJS_RESOLVE_ALIASES,
} = require('./webpack.shared');

module.exports = {
  entry: {
    main: ['webpack/hot/poll?100', './src/main.ts'],
  },
  target: 'node',
  devtool: 'inline-source-map',
  ignoreWarnings: NESTJS_IGNORED_WARNINGS,
  output: {
    path: join(__dirname, 'dist'),
    filename: '[name].js',
  },
  externals: [nodeExternals({ allowlist: ['webpack/hot/poll?100'] })],
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
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
    new RunScriptWebpackPlugin({ name: 'main.js', autoRestart: false }),
  ],
};
