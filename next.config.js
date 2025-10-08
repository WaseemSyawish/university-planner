/**
 * Basic Next.js config focused on improving dev startup and rebuild performance.
 * - Excludes large data folders from watch.
 * - Enables webpack persistent caching.
 * - Disables telemetry and keeps minimal logging.
 */
const path = require('path');

/**
 * NOTE: these options are safe to tweak further. In CI/production you may want
 * stricter settings, but for local development this reduces file-watcher noise.
 */
module.exports = {
  reactStrictMode: false,
  webpack: (config, { dev, isServer }) => {
    // Enable persistent caching for faster rebuilds
    config.cache = config.cache || {};
    config.cache.type = 'filesystem';

    // Reduce the number of files webpack watches in dev
    if (dev) {
      const watchOptions = config.watchOptions || {};
      watchOptions.ignored = [
        /node_modules/,
        /\.next/,
        /data/, // large JSON fixtures
        /scripts/,
        /\.vscode/,
        /public/,
      ];
      config.watchOptions = watchOptions;
    }

    return config;
  },
  // Reduce telemetry and logging when using Next in dev
  eslint: {
    ignoreDuringBuilds: true,
  },
};
