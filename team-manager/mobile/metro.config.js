const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field resolution so subpath imports like
// @trpc/server/unstable-core-do-not-import resolve correctly on Windows.
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './src/global.css' });
