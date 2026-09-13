import type { Quest, QuestType } from '@/types/models';

/**
 * Display copy for a quest, shared by the post-log interstitial and the
 * challenges screen.
 *
 * A `switch` rather than dynamic i18n indexing: `Quest.questType` is typed
 * over the full `QuestType` union (including `log_breakfast`/
 * `hit_protein_goal`/`log_weight`, none of which are ever issued by
 * `DAILY_QUESTS`/`WEEKLY_QUESTS`), but the `questTitles`/`questDescriptions`
 * i18n namespaces only define the 4 quest types actually in use.
 */

type ActiveQuestType =
  'log_all_meals' | 'hit_calorie_goal' | 'drink_water' | 'stay_active_week';

type Translate = (
  namespace: 'questTitles' | 'questDescriptions',
  key: ActiveQuestType,
) => string;

export function questTitle(t: Translate, questType: QuestType): string {
  switch (questType) {
    case 'log_all_meals':
    case 'hit_calorie_goal':
    case 'drink_water':
    case 'stay_active_week':
      return t('questTitles', questType);
    default:
      return questType;
  }
}

export function questDescription(t: Translate, quest: Quest): string {
  switch (quest.questType) {
    case 'log_all_meals':
    case 'drink_water':
    case 'stay_active_week':
      return t('questDescriptions', quest.questType).replace(
        '{target}',
        String(quest.target),
      );
    case 'hit_calorie_goal':
      return t('questDescriptions', quest.questType).replace(
        '{percent}',
        String(Math.round(quest.completionRatio * 100)),
      );
    default:
      return '';
  }
}
