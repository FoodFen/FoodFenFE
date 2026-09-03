/**
 * `jsxImportSource: 'nativewind'` routes JSX through NativeWind's runtime so
 * `className` is understood on every component.
 *
 * The Reanimated/Worklets babel plugin is intentionally NOT listed here:
 * `babel-preset-expo` adds `react-native-worklets/plugin` automatically when
 * `react-native-reanimated` is installed. Adding it manually registers it twice
 * and the build fails.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
