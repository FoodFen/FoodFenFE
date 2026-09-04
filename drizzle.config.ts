import type { Config } from 'drizzle-kit';

/**
 * `driver: 'expo'` makes drizzle-kit emit a `drizzle/migrations.js` bundle
 * alongside the raw SQL, which is what `useMigrations` consumes at runtime.
 * Regenerate with `npm run db:generate` after any change to `src/db/schema.ts`.
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
