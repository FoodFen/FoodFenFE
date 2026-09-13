import type { Translations } from './vi';

// `vi` is `as const`, so its leaves are string *literal* types. Widen them to
// `string` here — English text obviously isn't the same literal as Vietnamese.
export type DeepPartial<T> = T extends string
  ? string
  : { [K in keyof T]?: DeepPartial<T[K]> };

/**
 * English, filled in as the onboarding flow — the first (and so far only)
 * migrated feature — was translated. `translate()` falls back to Vietnamese
 * for whatever a future feature hasn't added here yet, so a partial
 * dictionary never renders a blank string.
 */
export const en: DeepPartial<Translations> = {
  common: {
    continue: 'Continue',
    back: 'Back',
    skip: 'Skip',
    save: 'Save',
    cancel: 'Cancel',
    done: 'Done',
    retry: 'Retry',
    enable: 'Enable',
    delete: 'Delete',
    name: 'Name',
    premium: 'Premium',
  },

  onboardingGender: {
    title: "What's your sex?",
    subtitle: 'This helps us personalize your daily calorie target.',
    male: 'Male',
    female: 'Female',
    preferNotToAnswer: 'Prefer not to answer',
    other: 'Other',
  },

  onboardingBirthYear: {
    title: 'What year were you born?',
    subtitle: 'Age affects how many calories your body needs each day.',
  },

  onboardingNotifications: {
    title: 'Stay on track',
    subtitle:
      'We can remind you to log meals and celebrate streaks. You can change this anytime in Settings.',
  },

  onboardingUnitSystem: {
    title: 'Which units do you use?',
    subtitle: 'This applies to every measurement in the app.',
    metric: 'Metric (cm, kg)',
    imperial: 'Imperial (ft/in, lb)',
  },

  onboardingHeight: {
    title: 'How tall are you?',
    subtitle: "Don't worry, you can change this anytime.",
  },

  onboardingWeight: {
    title: "What's your current weight?",
    subtitle: "Don't worry, you can change this anytime.",
  },

  onboardingActivity: {
    title: 'How active are you?',
    subtitle: 'This helps us estimate your daily calorie burn.',
  },

  onboardingGoal: {
    title: "What's your target weight?",
    subtitle: 'Leave it as-is if you just want to maintain.',
    maintain: 'Maintain',
    goalWeightLabel: 'Goal weight',
  },

  onboardingRate: {
    titleLose: 'How fast do you want to lose weight?',
    titleGain: 'How fast do you want to gain weight?',
    subtitleLose: 'You need to lose {amount} {unit} to reach your goal',
    subtitleGain: 'You need to gain {amount} {unit} to reach your goal',
    paceLabel: '{amount} {unit} per week',
    slowLoss: 'Slow loss',
    slowGain: 'Slow gain',
    moderateLoss: 'Moderate loss',
    moderateGain: 'Moderate gain',
    fastLoss: 'Fast loss',
    fastGain: 'Fast gain',
    tooSlowMessage: 'Too slow speed may reduce motivation.',
    safeMessage: 'Safe and sustainable speed for health.',
    reasonableMessage: 'Reasonable speed, suitable for your goal.',
    tooFastMessage: 'Too fast speed may affect your health.',
  },

  onboardingFinalize: {
    creatingPlan: 'Creating your plan…',
    calculatingBmi: 'Calculating your BMI…',
    gettingInsights: 'Getting insights about your goals…',
    calculationComplete: 'All set!',
    title: 'Congratulations!',
    subtitle: 'Your personal health plan is ready.',
    etaMessage: 'You can reach {weight} {unit} by {date}',
    editAnytime: 'You can edit this anytime',
    carbs: 'Carbs',
    protein: 'Protein',
    fat: 'Fat',
    yourBmi: 'Your BMI',
    yourWeightIs: 'Your weight is',
    kcalPerDay: 'kcal / day',
    getStarted: 'Get Started',
  },

  activityLevel: {
    sedentary: 'Sedentary',
    light: 'Light',
    moderate: 'Moderate',
    active: 'Active',
    very_active: 'Very active',
  },

  activityLevelDescription: {
    sedentary: 'Little or no exercise',
    light: '1–3 days a week',
    moderate: '3–5 days a week',
    active: '6–7 days a week',
    very_active: 'Hard training or physical job',
  },

  dietType: {
    balanced: 'Balanced',
    low_carb: 'Low carb',
    high_protein: 'High protein',
    keto: 'Keto',
    vegetarian: 'Vegetarian',
  },

  bmiCategory: {
    underweight: 'Underweight',
    healthy: 'Healthy',
    overweight: 'Overweight',
    obese: 'Obese',
  },

  profileBodyStats: {
    aboutYou: 'About you',
    sex: 'Sex',
    yearOfBirth: 'Year of birth',
    heightCm: 'Height (cm)',
    weight: 'Weight',
    currentKg: 'Current (kg)',
    goalKg: 'Goal (kg)',
    goalHint: 'The same as your current weight means maintain.',
    paceLabel: 'Pace — kg per week',
    activity: 'Activity',
    diet: 'Diet',
    dietHint: 'Changes how your calories are split across protein, carbs and fat.',
  },

  profileLanguage: {
    heading: 'Language',
    vietnamese: 'Tiếng Việt',
    english: 'English',
  },

  mealType: {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snacks',
  },

  profile: {
    title: 'Profile',
    yourAccount: 'Your account',
    guest: 'Guest',
    trackingOffline: 'Tracking offline on this device',
    signInToSync: 'Sign in to sync your data',
    offlineNotice:
      'Everything already works offline. An account keeps your diary backed up and available on another device.',
    change: 'change',
    changes: 'changes',
    savedOnDeviceOnly: 'saved on this device only',
    dailyTargets: 'Daily targets',
    editGoals: 'Edit goals and body stats',
    targetsManual: 'Set by hand — these override the calculated values.',
    targetsAuto: 'Calculated from your profile. Maintenance is about {kcal} kcal a day.',
    age: 'Age',
    height: 'Height',
    appearance: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    units: 'Units',
    kilograms: 'Kilograms',
    pounds: 'Pounds',
    signOut: 'Sign out',
    signOutMessage: 'Your diary stays on this device.',
    eraseLocalData: 'Erase local data',
    eraseMessage:
      'This permanently deletes your diary, your goals and your profile from this device. It cannot be undone.',
    eraseConfirm: 'Erase',
  },

  goals: {
    whatWouldBeCalculated: 'What would be calculated',
    yourNewTargets: 'Your new targets',
    manualWarning:
      'You are on manual targets ({kcal} kcal), so these calculated figures are not being used.',
    switchToCalculated: 'Switch to calculated targets',
    useCalculatedTitle: 'Use calculated targets',
    useCalculatedMessage:
      'Your targets will be worked out from your body stats and goal from today onward.',
    useCalculatedConfirm: 'Use calculated',
  },

  auth: {
    signInTitle: 'Sign in',
    createAccountTitle: 'Create account',
    welcomeBack: 'Welcome back',
    signInSubtitle:
      'Optional — your diary already works offline. An account keeps it backed up and available on your other devices.',
    email: 'Email',
    password: 'Password',
    invalidCredentials: 'That email and password do not match.',
    genericError: 'Something went wrong. Please try again.',
    newToApp: 'New to FoodFen?',
    createAccountLink: 'Create an account',
    createYourAccount: 'Create your account',
    signUpSubtitle:
      'Your diary stays on this device either way. An account is what lets it follow you to another one.',
    passwordHint: 'At least 8 characters, including a number.',
    confirmPassword: 'Confirm password',
    alreadyHaveAccount: 'Already have an account?',
  },

  entryDetail: {
    loadError: 'That meal could not be loaded.',
    deleteConfirmMessage: 'Remove this meal from your diary?',
    at: 'at',
    caloriesMacros: 'Calories & Macros',
    edit: 'Edit',
    total: 'Total',
    fiber: 'Fiber',
    ingredients: 'Ingredients',
    noBreakdown: 'This meal was logged without a breakdown.',
    wasThisRight: 'Was this right?',
    aiFeedbackHint: 'Your answer helps improve how meals are read.',
    looksRight: 'Looks right',
    notQuite: 'Not quite',
    deleteMealButton: 'Delete meal',
  },

  entryEdit: {
    layoutTitle: 'Edit meal',
    loadError: 'That meal could not be loaded.',
    name: 'Name',
    mealType: 'Meal',
    calories: 'Calories',
    macros: 'Macros',
    carbs: 'Carbs',
    protein: 'Protein',
    fat: 'Fat',
    reconcileWarning: 'The calories do not match the macro totals.',
    multiIngredientNote:
      'Meals with several ingredients can only have their name and meal edited here.',
    save: 'Save',
    saveErrorTitle: 'Could not save the changes',
    saveErrorFallback: 'Please try again.',
  },

  logMeal: {
    layoutTitle: 'Log a meal',
    mealNameLabel: 'Meal name',
    mealNameHint: 'Optional — we will name it after its ingredients.',
    mealLabel: 'Meal',
    emptyHint: 'Add what was in this meal. Pick from the built-in list, or enter your own.',
    removeIngredientA11y: 'Remove {name}',
    addIngredientA11y: 'Add an ingredient',
    addIngredientLabel: '+ Add ingredient',
    saveToDiary: 'Save to diary',
    saveErrorTitle: 'Could not save that meal',
    saveErrorFallback: 'Please try again.',
  },

  logIngredient: {
    layoutTitle: 'Add ingredient',
    searchPlaceholder: 'Search foods',
    clearSearchA11y: 'Clear search',
    foodA11y: '{name}, {kcal} kcal per 100 grams',
    kcalPer100g: '{kcal} kcal / 100 g',
    noMatches: 'No matches',
    noMatchesDescription: 'Nothing in the built-in list for “{query}”.',
    searchHint: 'Search the built-in list of common foods, or enter one yourself below.',
    enterYourOwn: 'Enter your own',
    premiumHint:
      'Adding an ingredient by hand is a Premium feature. Everything in the built-in list stays free.',
    backToSearch: '← Back to search',
    amount: 'Amount',
    amountError: 'Enter an amount above zero.',
    serving: 'Serving',
    calories: 'Calories',
    weight: 'Weight',
    weightGrams: 'Weight (g)',
    addToMeal: 'Add to meal',
  },

  logSearch: {
    layoutTitle: 'Find a food',
    searchPlaceholder: 'Pho, milk tea, com tam…',
    clearSearchA11y: 'Clear search',
    recentHeading: 'Recent',
    searchHint: 'Type at least 2 characters to search.',
    noMatches: 'No foods found',
    noMatchesDescription: 'Nothing matched “{query}”.',
    perServing: '{kcal} kcal / {serving}',
    foodA11y: '{name}, {kcal} kcal',
    recentA11y: '{name}, logs your last portion',
    amount: 'Amount',
    serving: 'Serving',
    add: 'Add',
    addErrorTitle: 'Could not log that food',
  },

  logManual: {
    layoutTitle: 'Manual entry',
    mealName: 'Food name',
    mealNamePlaceholder: 'e.g. Beef pho',
    smartEntry: 'Describe it in one sentence (AI)',
    comingSoon: 'Coming soon',
    suggestionsA11y: 'Food suggestions',
    pickSuggestionA11y: '{name}, fill the numbers from the built-in list',
    amountEaten: 'Amount eaten',
    grams: 'Grams',
    serving: 'Serving',
    calories: 'Calories',
    macros: 'Macronutrients',
    carbs: 'Carbs',
    protein: 'Protein',
    fat: 'Fat',
    gramSuffix: 'g',
    reconcileWarning: 'The calories entered are well off the total from carbs, protein and fat.',
    save: 'Save',
    saveErrorTitle: 'Could not save that food',
    saveErrorFallback: 'Please try again.',
    modeVoice: 'Voice',
    modeImage: 'Image',
    modeManual: 'Manual',
  },

  logActivity: {
    layoutTitle: 'Activity',
    presetHeading: 'Pick an activity',
    kcalPer30Min: '{kcal} kcal / 30 min',
    pickPresetA11y: '{name}, {kcal} kcal per 30 minutes',
    durationLabel: 'Duration',
    customMinutes: 'Custom (minutes)',
    minutesSuffix: 'min',
    timeLabel: 'Time',
    now: 'Now',
    pickTime: 'Pick a time',
    freeTextLabel: 'Type your workout (e.g. cycling for 45 minutes)',
    save: 'Save',
    saveErrorTitle: 'Could not save that activity',
  },

  activityPresets: {
    walking: 'Walking',
    running: 'Running',
    cycling: 'Cycling',
    elliptical: 'Elliptical',
    swimming: 'Swimming',
    strength: 'Strength training',
  },

  dashboard: {
    pointsA11y: '{count} reward points',
    openShop: 'Open shop',
    openSettings: 'Open settings',
    target: 'Target',
    consumed: 'Consumed',
    burned: 'Burned',
    carbs: 'Carbs',
    protein: 'Protein',
    fat: 'Fat',
    fiber: 'Fiber',
    sugar: 'Sugar',
    sodium: 'Sodium',
    comingSoon: 'Coming soon',
    caloriesEaten: 'Calories eaten',
    caloriesBurned: 'Calories burned',
    steps: 'Steps',
    noWorkouts: 'No workouts yet',
    burnGoal: 'Goal: {kcal} kcal',
    water: 'Water',
    waterGoal: 'Goal: {ml} ml',
    fiberDailyLevel: 'Daily level',
    viewFiberIntake: 'View your fiber intake',
    weight: 'Weight',
    weightGoal: 'Goal: {weight} kg',
    weightToGo: '{delta} kg to go',
    weightReached: 'Goal reached',
    logFirstMeal: 'Log your first meal!',
    kcalLeft: '{kcal} kcal left',
    kcalOver: '{kcal} kcal over',
    addA11y: 'Add',
    viewEntriesA11y: 'View logged meals',
    moreEntries: '+{count}',
  },

  dayEntries: {
    empty: 'Nothing logged on this day yet.',
  },

  logSheet: {
    title: 'What do you want to log?',
    weight: 'Log weight',
    water: 'Log water',
    activity: 'Log activity',
    food: 'Log food',
    search: 'Find a food',
    manualEntry: 'Manual entry',
    weightLabel: 'Weight (kg)',
    weightError: 'Enter a weight between 0 and 500 kg.',
    waterLabel: 'How much water?',
    save: 'Save',
  },

  settings: {
    title: 'Settings',
    ringColorsRow: 'Ring colors explained',
  },

  achievements: {
    title: 'Achievements',
    emptyTitle: 'Achievements coming soon',
    emptyDescription: 'Streaks, quests and badges will show up here.',
  },

  shop: {
    title: 'Shop',
    emptyTitle: 'Shop coming soon',
    emptyDescription: 'Spend your reward points on items — coming soon.',
  },

  ringColors: {
    title: 'Ring Colors Explained',
    intro:
      'On the homepage calendar, the colored rings around each date show how close you were to your daily calorie goal:',
    under: 'Black',
    underDescription: 'More than 500 kcal below your target',
    green: 'Green',
    greenDescription: 'Up to 100 calories over your target',
    yellow: 'Yellow',
    yellowDescription: '100–200 calories over your goal',
    red: 'Red',
    redDescription: 'More than 200 calories over your goal',
    faint: 'Faint',
    faintDescription: 'No meals logged that day',
  },

  weekStrip: {
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
  },

  developer: {
    heading: 'Developer',
    seedData: 'Seed recent days',
    on: 'On',
    off: 'Off',
  },
};
