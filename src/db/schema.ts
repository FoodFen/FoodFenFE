import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The CalSnap ERD v1.0.0, as the on-device SQLite schema.
 *
 * Three deliberate departures from the server-side ERD, each because this copy
 * lives on a phone that may never have talked to a server:
 *
 * 1. **Text ids, not autoincrement ints.** A local row needs an id the moment
 *    it is created, long before a server exists to assign one. Every table
 *    therefore has a locally generated `id` plus a nullable `remote_id` that
 *    sync fills in with the server's integer key.
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
  /** The server's integer PK once this row has been pushed. */
  remoteId: integer('remote_id'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  /** Null, or older than `updated_at`, means "not yet pushed to the server". */
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  /** Soft delete — a row removed offline still has to be removed server-side. */
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export type Gender = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'balanced' | 'low_carb' | 'high_protein' | 'keto' | 'vegetarian';
/** Whether daily targets are derived from the profile or set by hand. */
export type CalorieCalcMode = 'auto' | 'manual';
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
  /** Kilograms. */
  weightCurrent: real('weight_current').notNull(),
  /** Kilograms. */
  weightGoal: real('weight_goal').notNull(),
  activityLevel: text('activity_level').$type<ActivityLevel>().notNull(),
  dietType: text('diet_type').$type<DietType>().notNull().default('balanced'),
  calorieCalcMode: text('calorie_calc_mode')
    .$type<CalorieCalcMode>()
    .notNull()
    .default('auto'),
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
  ...syncColumns,
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
  | 'log_weight';

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
    /** `yyyy-MM-dd` — quests are issued per day. */
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
