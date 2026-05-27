const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

const mainConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'electron-main',
  entry: { main: './src/main/main.ts' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    '@overwolf/ow-electron': 'commonjs @overwolf/ow-electron',
    'tesseract.js': 'commonjs tesseract.js',
  },
  node: { __dirname: false, __filename: false },
  devtool: isProd ? false : 'source-map',
};

const preloadConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'electron-preload',
  entry: { preload: './src/main/preload.ts' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: { extensions: ['.ts', '.js'] },
  devtool: isProd ? false : 'source-map',
};

const rendererConfig = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  entry: {
    dashboard: './src/dashboard/index.tsx',
    overlay: './src/overlay/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dashboard.html',
      filename: 'dashboard.html',
      chunks: ['dashboard'],
    }),
    new HtmlWebpackPlugin({
      template: './overlay.html',
      filename: 'overlay.html',
      chunks: ['overlay'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'assets', to: 'assets', noErrorOnMissing: true },
      ],
    }),
  ],
  devtool: isProd ? false : 'source-map',
};

module.exports = [mainConfig, preloadConfig, rendererConfig];
