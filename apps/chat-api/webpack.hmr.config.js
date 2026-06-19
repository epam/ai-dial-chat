const { join } = require('path');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: {
    main: ['webpack/hot/poll?100', './src/main.ts'],
  },
  target: 'node',
  devtool: 'inline-source-map',
  output: {
    path: join(__dirname, 'dist'),
    filename: '[name].js',
  },
  externals: [nodeExternals({ allowlist: ['webpack/hot/poll?100'] })],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: require.resolve('null-loader'),
      },
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
      'file-type': false,
      '@nestjs/websockets/socket-module': false,
      '@nestjs/microservices/microservices-module': false,
      '@nestjs/microservices': false,
      'class-transformer/storage': false,
      '@fastify/static': false,
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
