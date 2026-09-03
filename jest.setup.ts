/**
 * Test environment setup.
 *
 * `@testing-library/react-native` v13+ registers its jest matchers on import,
 * so there is no `extend-expect` entry point to pull in here.
 *
 * Native modules that have no JS fallback are stubbed here. Anything that
 * degrades on its own — MMKV, for instance, which falls back to an in-memory
 * map in `src/lib/storage.ts` — is deliberately left alone so the tests
 * exercise the same fallback path the app would.
 */

// `expo-secure-store` has no mock implementation; back it with a plain map so
// auth-store tests can round-trip a session.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Nitro-backed native module; it throws on import outside a native runtime.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    throw new Error('MMKV is unavailable in tests');
  },
}));

// Silence the Reanimated startup warning; the mock ships with the library.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
