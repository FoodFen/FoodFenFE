// Pure mascot rules: which look the dashboard mascot has for a given clock, water total and diary.
import type { MealType } from '@/db/schema';
import type { TimeOfDay } from '@/lib/notificationScheduler';

export type MascotAction =
  | 'idle'
  | 'hungry'
  | 'thirsty'
  | 'eating'
  | 'drinking'
  | 'exercising'
  | 'thinking'
  | 'happy'
  | 'confused';

export type MascotReaction = 'food' | 'water' | 'activity';

export const REACTION_ACTION: Record<MascotReaction, MascotAction> = {
  food: 'eating',
  water: 'drinking',
  activity: 'exercising',
};

export type MascotMeal = 'breakfast' | 'lunch' | 'dinner';

const MEAL_ORDER: MascotMeal[] = ['breakfast', 'lunch', 'dinner'];

const minutesOf = (t: TimeOfDay) => t.hour * 60 + t.minute;

const minutesOfDate = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function isThirsty(args: {
  now: Date;
  wake: TimeOfDay;
  sleep: TimeOfDay;
  waterMl: number;
  targetWaterMl: number;
  lagPct: number;
}): boolean {
  const { now, wake, sleep, waterMl, targetWaterMl, lagPct } = args;

  if (targetWaterMl <= 0) return false;

  const nowMin = minutesOfDate(now);
  const wakeMin = minutesOf(wake);
  const sleepMin = minutesOf(sleep);

  if (sleepMin <= wakeMin || nowMin < wakeMin || nowMin >= sleepMin) return false;

  const expected = (nowMin - wakeMin) / (sleepMin - wakeMin);

  return waterMl / targetWaterMl < expected - lagPct / 100;
}

export function hungryMeal(args: {
  now: Date;
  times: Record<MascotMeal, TimeOfDay>;
  loggedMeals: Iterable<MealType>;
}): MascotMeal | null {
  const nowMin = minutesOfDate(args.now);
  const logged = new Set(args.loggedMeals);
  let latest: MascotMeal | null = null;

  for (const meal of MEAL_ORDER) {
    const at = minutesOf(args.times[meal]);

    if (at <= nowMin && (latest === null || at >= minutesOf(args.times[latest])))
      latest = meal;
  }

  return latest !== null && !logged.has(latest) ? latest : null;
}
