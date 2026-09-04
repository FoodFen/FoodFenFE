const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle ships migrations as `.sql` files that `drizzle/migrations.js`
// imports; Metro has to treat them as source for `babel-plugin-inline-import`
// to inline them.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
