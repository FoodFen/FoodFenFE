/// <reference types="nativewind/types" />

// Metro treats a CSS import as a side effect that registers the compiled
// styles. Expo generates an equivalent declaration in `expo-env.d.ts`, but
// that file is generated and gitignored, so declare it here too — otherwise a
// clean checkout fails to typecheck before the dev server has ever run.
declare module '*.css';
