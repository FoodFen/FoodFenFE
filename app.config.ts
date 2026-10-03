import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Native-only app config (no web target).
 *
 * Read `process.env.APP_VARIANT` so dev / preview / production builds can live
 * side by side on one device with distinct bundle identifiers.
 */
const VARIANT = process.env.APP_VARIANT ?? 'development';

const NAME_BY_VARIANT: Record<string, string> = {
  development: 'FoodFen (Dev)',
  preview: 'FoodFen (Preview)',
  production: 'FoodFen',
};

const ID_SUFFIX_BY_VARIANT: Record<string, string> = {
  development: '.dev',
  preview: '.preview',
  production: '',
};

const BUNDLE_ID = `com.foodfen.app${ID_SUFFIX_BY_VARIANT[VARIANT] ?? ''}`;

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

function pluginName(entry: PluginEntry): string {
  return Array.isArray(entry) ? String(entry[0]) : String(entry);
}

const OWN_PLUGINS: PluginEntry[] = [
  'expo-router',
  'expo-font',
  'expo-image',
  'expo-secure-store',
  'expo-localization',
  'expo-web-browser',
  'expo-sqlite',
  [
    'expo-splash-screen',
    {
      image: './assets/splash-icon.png',
      imageWidth: 180,
      resizeMode: 'contain',
      backgroundColor: '#F9FAFB',
      dark: { backgroundColor: '#09090B' },
    },
  ],
  [
    'expo-camera',
    {
      cameraPermission:
        'FoodFen uses the camera so you can log a meal by taking a photo of it.',
      recordAudioAndroid: false,
    },
  ],
  [
    'expo-image-picker',
    {
      photosPermission:
        'FoodFen needs access to your photos so you can attach an existing picture to a meal.',
    },
  ],
  [
    'expo-speech-recognition',
    {
      microphonePermission:
        'FoodFen uses the microphone so you can describe a meal by speaking instead of typing.',
      speechRecognitionPermission:
        'FoodFen uses speech recognition to turn what you say into text for describing a meal.',
    },
  ],
  ['expo-notifications', { color: '#16A34A' }],
  'expo-apple-authentication',
  [
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.placeholder',
    },
  ],
  'react-native-health-connect',
  '@kingstinct/react-native-healthkit',
  [
    'expo-build-properties',
    {
      ios: { useFrameworks: 'static' },
      android: { minSdkVersion: 26 },
    },
  ],
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME_BY_VARIANT[VARIANT] ?? 'FoodFen',
  slug: 'foodfen',
  scheme: 'foodfen',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  assetBundlePatterns: ['**/*'],

  // --- EAS Update Configuration Added Here ---
  updates: {
    url: 'https://u.expo.dev/0fbdbbb5-613b-46b5-9e28-c614d47d4e51',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  // -------------------------------------------

  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'FoodFen uses the camera so you can log a meal by taking a photo of it.',
      NSPhotoLibraryUsageDescription:
        'FoodFen needs access to your photos so you can attach an existing picture to a meal.',
      NSMicrophoneUsageDescription:
        'FoodFen does not record audio; this permission is required by the camera module.',
      NSHealthShareUsageDescription:
        'FoodFen reads your step count so it can estimate the calories you burned walking today.',
    },
  },

  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#DCFCE7',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'],
  },

  plugins: [
    ...(config.plugins ?? []).filter(
      (plugin) => !OWN_PLUGINS.some((own) => pluginName(own) === pluginName(plugin)),
    ),
    ...OWN_PLUGINS,
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    variant: VARIANT,
    eas: {
      projectId: '0fbdbbb5-613b-46b5-9e28-c614d47d4e51',
    },
  },
});