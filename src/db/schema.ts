import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The FoodFen ERD v1.0.0, as the on-device SQLite schema.
 *
 * Three deliberate departures from the server-side ERD, each because this copy
 * lives on a phone that may never have talked to a server:
 *
 * 1. **Text ids, not autoincrement ints.** A local row needs an id the moment
 *    it is created, long before a server exists to assign one. Every table
 *    therefore has a locally generated `id` plus a nullable `remote_id` that
 *    sync fills in with the server's key — a UUID string everywhere except
 *    `user`, whose server-side table is the one integer-PK exception (see
 *    `userSyncColumns` below).
 *
 * 2. **Sync columns on every user-owned table.** `updated_at` and `synced_at`
 *    are what make "write locally, push later" possible: a row whose
 *    `synced_at` is null (or older than `updated_at`) has not reached the
 *    server yet. `deleted_at` is a soft delete, because a row deleted offline
 *    still has to be deleted on the server later — a vanished row cannot be.
 *
 * 3. **No `password_hash`.** It is in the ERD because the server needs it. A
 *    device never should, so it is not mirrored here.
 *
 * Columns marked "extension" are not in ERD v1.0.0 and are noted individually.
 */

/** Columns every syncable, user-owned table carries. */
const syncColumns = {
  /** The server's UUID once this row has been pushed. */
  remoteId: text('remote_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  /** Null, or older than `updated_at`, means "not yet pushed to the server". */
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  /** Soft delete — a row removed offline still has to be removed server-side. */
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

/**
 * Same as `syncColumns`, but for `user` only: the server's `user` table is
 * the sole exception to UUID primary keys (integer, per the backend's own
 * convention), so its `remote_id` has to match that instead of the UUID
 * `remote_id` every other synced table carries.
 */
const userSyncColumns = {
  ...syncColumns,
  remoteId: integer('remote_id'),
};

export type Gender = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'balanced' | 'low_carb' | 'high_protein' | 'keto' | 'vegetarian';
/** Whether daily targets are derived from the profile or set by hand. */
export type CalorieCalcMode = 'auto' | 'manual';
/**
 * Whether burned exercise calories add back into "calories left". `smart`
 * assumes the activity-level multiplier already bakes in routine activity, so
 * adding logged exercise back on top would double-count it; `all_calories`
 * adds every logged activity back regardless.
 */
export type CalorieLeftMode = 'smart' | 'all_calories';
export type SubscriptionTier = 'free' | 'premium';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  /** Null for a local-only (guest) profile — an account is optional. */
  email: text('email'),
  displayName: text('display_name'),
  gender: text('gender').$type<Gender>().notNull(),
  birthYear: integer('birth_year').notNull(),
  unitSystem: text('unit_system').$type<UnitSystem>().notNull().default('metric'),
  /** Centimetres. Always metric in storage; `unitSystem` is display only. */
  height: real('height').notNull(),
  /**
   * Kilograms. An onboarding baseline only — never rewritten afterward.
   * Anything that needs "current weight" (the BMR formula included) should
   * prefer the latest `weight_log` row via `logRepository.getLatestWeight`,
   * falling back to this only when no weigh-in has ever been logged.
   */
  weightCurrent: real('weight_current').notNull(),
  /** Kilograms. */
  weightGoal: real('weight_goal').notNull(),
  activityLevel: text('activity_level').$type<ActivityLevel>().notNull(),
  dietType: text('diet_type').$type<DietType>().notNull().default('balanced'),
  calorieCalcMode: text('calorie_calc_mode')
    .$type<CalorieCalcMode>()
    .notNull()
    .default('auto'),
  /**
   * Extension: not in ERD v1.0.0. Defaults to `all_calories` — the arithmetic
   * every existing row already had before this column existed — so adding it
   * changes no one's displayed number until they switch it themselves.
   */
  calorieLeftMode: text('calorie_left_mode')
    .$type<CalorieLeftMode>()
    .notNull()
    .default('all_calories'),
  subscriptionTier: text('subscription_tier')
    .$type<SubscriptionTier>()
    .notNull()
    .default('free'),
  /**
   * Extension: kilograms per week the user is aiming to move, magnitude only —
   * the direction comes from `weightGoal` vs `weightCurrent`. The ERD has
   * nowhere to put the pace, and the calorie target cannot be derived without
   * it.
   */
  weeklyRateKg: real('weekly_rate_kg').notNull().default(0.5),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  ...userSyncColumns,
});

/**
 * Daily targets, kept as history rather than a single mutable row: changing
 * your goal today must not rewrite what you were aiming for last week. The
 * row in force on a given day is the newest one whose `effectiveDate` is on or
 * before it.
 */
export const dailyGoal = sqliteTable(
  'daily_goal',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    targetKcal: integer('target_kcal').notNull(),
    targetCarbsG: real('target_carbs_g').notNull(),
    targetProteinG: real('target_protein_g').notNull(),
    targetFatG: real('target_fat_g').notNull(),
    targetWaterMl: integer('target_water_ml').notNull().default(2000),
    /** `yyyy-MM-dd`, local calendar day. */
    effectiveDate: text('effective_date').notNull(),
    ...syncColumns,
  },
  (table) => [index('daily_goal_user_date_idx').on(table.userId, table.effectiveDate)],
);

export type InputMethod = 'voice' | 'image' | 'type' | 'manual';
export type AiFeedback = 'up' | 'down';
/** Extension — see `mealType` below. */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const foodEntry = sqliteTable(
  'food_entry',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** What the user called this meal. */
    name: text('name').notNull(),
    /**
     * Extension: a user-chosen emoji, overriding `foodEmojiFor`'s keyword
     * guess wherever this entry is shown. Null means "keep guessing from the
     * name" — most entries never set this.
     */
    emoji: text('emoji'),
    inputMethod: text('input_method').$type<InputMethod>().notNull(),
    imageUrl: text('image_url'),
    /**
     * Totals are stored, not derived, even though they are the sum of the
     * entry's ingredients: the diary list renders hundreds of rows and must
     * not re-sum a join to do it. `recalculateTotals` is the only writer.
     */
    totalKcal: integer('total_kcal').notNull().default(0),
    carbsG: real('carbs_g').notNull().default(0),
    proteinG: real('protein_g').notNull().default(0),
    fatG: real('fat_g').notNull().default(0),
    /** Premium-only field; free accounts do not see it. */
    fiberG: real('fiber_g'),
    /**
     * Extension: how much the user said they ate, kept as a label rather than a
     * normalized weight. `amount` is the number and `amountUnit` its unit
     * (`'g'` or `'serving'`). Manual aggregate entries (UC-12) store exactly
     * what was picked, with no conversion or scaling; both are null for catalog
     * and composed-meal entries, whose portion already lives on the ingredient
     * rows.
     */
    amount: real('amount'),
    amountUnit: text('amount_unit').$type<'g' | 'serving'>(),
    /** Thumbs up/down on the AI's extraction, for future model feedback. */
    aiFeedback: text('ai_feedback').$type<AiFeedback>(),
    /**
     * Extension: which meal this belongs to. The ERD has no such column, but
     * the diary groups by meal, and deriving it from the clock would guess
     * wrong for anyone who eats off-schedule.
     */
    mealType: text('meal_type').$type<MealType>().notNull(),
    loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
    /**
     * Extension: the local calendar day of `loggedAt`, as `yyyy-MM-dd`.
     * The diary is keyed by day, and deriving the day from a timestamp inside
     * SQLite would apply the device's *current* offset rather than the one in
     * force when the meal was eaten. Storing it once, at write time, is the
     * only version that survives travel and daylight saving.
     */
    loggedOn: text('logged_on').notNull(),
    ...syncColumns,
  },
  (table) => [index('food_entry_user_day_idx').on(table.userId, table.loggedOn)],
);

export const ingredient = sqliteTable(
  'ingredient',
  {
    id: text('id').primaryKey(),
    foodEntryId: text('food_entry_id')
      .notNull()
      .references(() => foodEntry.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    quantityG: real('quantity_g').notNull(),
    kcal: integer('kcal').notNull(),
    carbsG: real('carbs_g').notNull().default(0),
    proteinG: real('protein_g').notNull().default(0),
    fatG: real('fat_g').notNull().default(0),
    /** Premium-only, mirroring `foodEntry.fiberG`. */
    fiberG: real('fiber_g'),
    /**
     * Extension: the bundled-catalog food this row was prefilled from, if any.
     * Free text stays free text; this only records provenance.
     */
    catalogFoodId: text('catalog_food_id'),
    ...syncColumns,
  },
  (table) => [index('ingredient_entry_idx').on(table.foodEntryId)],
);

export type ActivitySource = 'manual' | 'apple_health' | 'google_fit';

export const activityLog = sqliteTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').notNull(),
    caloriesBurned: integer('calories_burned').notNull(),
    source: text('source').$type<ActivitySource>().notNull().default('manual'),
    loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
    /** Extension, for the same reason as `foodEntry.loggedOn`. */
    loggedOn: text('logged_on').notNull(),
    ...syncColumns,
  },
  (table) => [index('activity_log_user_day_idx').on(table.userId, table.loggedOn)],
);

export const weightLog = sqliteTable(
  'weight_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Kilograms. */
    weight: real('weight').notNull(),
    /** `yyyy-MM-dd`, local calendar day. */
    recordedAt: text('recorded_at').notNull(),
    ...syncColumns,
  },
  (table) => [index('weight_log_user_date_idx').on(table.userId, table.recordedAt)],
);

export const waterLog = sqliteTable(
  'water_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amountMl: integer('amount_ml').notNull(),
    loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
    /** Extension, for the same reason as `foodEntry.loggedOn`. */
    loggedOn: text('logged_on').notNull(),
    ...syncColumns,
  },
  (table) => [index('water_log_user_day_idx').on(table.userId, table.loggedOn)],
);

export const streak = sqliteTable('streak', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  /** `yyyy-MM-dd` of the last day with any logged entry. */
  lastActiveDate: text('last_active_date'),
  ...syncColumns,
});

export type QuestType =
  | 'log_breakfast'
  | 'log_all_meals'
  | 'hit_calorie_goal'
  | 'hit_protein_goal'
  | 'drink_water'
  | 'log_weight'
  | 'stay_active_week';

export type QuestCadence = 'daily' | 'weekly';

export const quest = sqliteTable(
  'quest',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    questType: text('quest_type').$type<QuestType>().notNull(),
    progress: integer('progress').notNull().default(0),
    target: integer('target').notNull(),
    rewardCoins: integer('reward_coins').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    /**
     * Extension: `'daily'` quests are issued fresh each day; `'weekly'` ones
     * once per calendar week. Not in ERD v1.0.0 — quests were a single-day
     * concept there.
     */
    cadence: text('cadence').$type<QuestCadence>().notNull().default('daily'),
    /**
     * Extension: the fraction of `target` that counts as complete — copied
     * onto the row at issuance so a later change to a quest's definition can
     * never rewrite what a past quest actually required, the same reasoning
     * `target`/`rewardCoins` already follow. `1` (the default) means the
     * previous, simpler behavior: complete only at `progress >= target`.
     */
    completionRatio: real('completion_ratio').notNull().default(1),
    /**
     * `yyyy-MM-dd` — the day a daily quest is issued for, or the Monday a
     * weekly quest's week starts on.
     */
    questDate: text('quest_date').notNull(),
    ...syncColumns,
  },
  (table) => [index('quest_user_date_idx').on(table.userId, table.questDate)],
);

export type CoinReason =
  'quest_completed' | 'streak_bonus' | 'purchase' | 'spend' | 'adjustment';

export const coinTransaction = sqliteTable(
  'coin_transaction',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Signed: positive credits, negative debits. The balance is their sum. */
    amount: integer('amount').notNull(),
    reason: text('reason').$type<CoinReason>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    ...syncColumns,
  },
  (table) => [index('coin_transaction_user_idx').on(table.userId)],
);

export type PlanType = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial';

export const subscription = sqliteTable('subscription', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  planType: text('plan_type').$type<PlanType>().notNull(),
  status: text('status').$type<SubscriptionStatus>().notNull(),
  /** `yyyy-MM-dd`. */
  startDate: text('start_date').notNull(),
  /** `yyyy-MM-dd`. */
  endDate: text('end_date'),
  price: real('price').notNull(),
  ...syncColumns,
});

export const userRelations = relations(user, ({ many, one }) => ({
  dailyGoals: many(dailyGoal),
  foodEntries: many(foodEntry),
  activityLogs: many(activityLog),
  weightLogs: many(weightLog),
  waterLogs: many(waterLog),
  quests: many(quest),
  coinTransactions: many(coinTransaction),
  streak: one(streak),
  subscription: one(subscription),
}));

export const foodEntryRelations = relations(foodEntry, ({ one, many }) => ({
  user: one(user, { fields: [foodEntry.userId], references: [user.id] }),
  ingredients: many(ingredient),
}));

export const ingredientRelations = relations(ingredient, ({ one }) => ({
  foodEntry: one(foodEntry, {
    fields: [ingredient.foodEntryId],
    references: [foodEntry.id],
  }),
}));

export const dailyGoalRelations = relations(dailyGoal, ({ one }) => ({
  user: one(user, { fields: [dailyGoal.userId], references: [user.id] }),
}));

export const streakRelations = relations(streak, ({ one }) => ({
  user: one(user, { fields: [streak.userId], references: [user.id] }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}));

/** Row types, inferred from the schema so they can never drift from it. */
export type UserRow = typeof user.$inferSelect;
export type NewUserRow = typeof user.$inferInsert;
export type DailyGoalRow = typeof dailyGoal.$inferSelect;
export type NewDailyGoalRow = typeof dailyGoal.$inferInsert;
export type FoodEntryRow = typeof foodEntry.$inferSelect;
export type NewFoodEntryRow = typeof foodEntry.$inferInsert;
export type IngredientRow = typeof ingredient.$inferSelect;
export type NewIngredientRow = typeof ingredient.$inferInsert;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type NewActivityLogRow = typeof activityLog.$inferInsert;
export type WeightLogRow = typeof weightLog.$inferSelect;
export type NewWeightLogRow = typeof weightLog.$inferInsert;
export type WaterLogRow = typeof waterLog.$inferSelect;
export type NewWaterLogRow = typeof waterLog.$inferInsert;
export type StreakRow = typeof streak.$inferSelect;
export type QuestRow = typeof quest.$inferSelect;
export type CoinTransactionRow = typeof coinTransaction.$inferSelect;
export type SubscriptionRow = typeof subscription.$inferSelect;
