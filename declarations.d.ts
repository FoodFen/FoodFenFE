/**
 * Ambient module declarations for non-code assets Metro can import.
 *
 * Drizzle's generated `drizzle/migrations.js` imports each migration as a
 * `.sql` file; `babel-plugin-inline-import` turns those into strings at build
 * time (see `babel.config.js`), so to TypeScript they are string modules.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
