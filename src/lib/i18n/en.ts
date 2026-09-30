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
    dismiss: 'Dismiss',
    calories: 'Calories',
    water: 'Water',
    somethingWentWrong: 'Something went wrong',
    pleaseTryAgain: 'Please try again.',
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
    birthYearError: 'Enter a valid year of birth.',
    birthYearTooYoungError: 'You must be at least 13.',
    heightError: 'Enter your height in cm.',
    weightCurrentError: 'Enter your weight in kg.',
    weightGoalError: 'Enter a goal weight in kg.',
    paceRequiredError: 'Choose how fast you want to get there.',
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
    upgradeToPremium: 'Upgrade to Premium',
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
    challengeProgress: 'Challenge progress',
    challengeProgressCaption:
      'Show the challenge screen after logging a meal, activity, or water.',
    signOut: 'Sign out',
    signOutMessage: 'Your diary stays on this device.',
    eraseLocalData: 'Erase local data',
    eraseMessage:
      'This permanently deletes your diary, your goals and your profile from this device. It cannot be undone.',
    eraseConfirm: 'Erase',
  },

  goals: {
    layoutTitle: 'Goals',
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
    emailInvalidError: 'Enter a valid email address.',
    passwordRequiredError: 'Enter your password.',
    displayNameRequiredError: 'Tell us what to call you.',
    passwordMinLengthError: 'Use at least {count} characters.',
    passwordNeedsDigitError: 'Include at least one number.',
    passwordsMismatchError: 'Passwords do not match.',
    orDivider: 'or',
  },

  entryDetail: {
    layoutTitle: 'Meal',
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
    emptyHint:
      'Add what was in this meal. Pick from the built-in list, or enter your own.',
    removeIngredientA11y: 'Remove {name}',
    lowConfidenceA11y: 'AI guess — double check this',
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
    chooseEmojiA11y: 'Choose an emoji for this food',
    mealNamePlaceholder: 'e.g. Beef pho',
    describeHint:
      'Describe what you ate in one sentence — type it, or tap the mic to speak — and AI will estimate the nutrition.',
    describeListening: 'Listening...',
    describeStartListening: 'Start describing by voice',
    describeStopListening: 'Stop recording',
    describeMicPermissionTitle: 'Microphone access needed',
    describeMicPermissionMessage:
      "Allow FoodFen to use the microphone and speech recognition in your device's settings to use this.",
    smartEntryPlaceholder: 'e.g. A bowl of beef pho with extra herbs',
    smartEntryAnalyze: 'Analyze',
    aiAnalyzePhoto: 'Analyze photo',
    aiRetakePhoto: 'Choose a different photo',
    aiTakePhoto: 'Take a photo',
    aiChooseFromLibrary: 'Choose from library',
    aiImageHint: 'Take or choose a photo of your meal and AI will estimate what’s in it.',
    aiErrorTitle: 'Could not analyze that',
    aiErrorFallback: 'Please try again.',
    aiUnavailableTitle: 'AI capture is unavailable',
    aiUnavailableDescription:
      'This feature needs an account and a connection. Sign in from Profile to use it.',
    aiSignIn: 'Sign in',
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
    reconcileWarning:
      'The calories entered are well off the total from carbs, protein and fat.',
    save: 'Save',
    saveErrorTitle: 'Could not save that food',
    saveErrorFallback: 'Please try again.',
    modeDescribe: 'Describe',
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
    openChat: 'Open AI assistant',
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
    automaticActivity: 'automatic',
    reconnectHealth: 'Reconnect',
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
    editWaterGoalA11y: 'Change water goal',
    backToToday: 'Today',
    moreEntries: '+{count}',
    dayLoadError: 'That day could not be loaded.',
  },

  dayEntries: {
    empty: 'Nothing logged on this day yet.',
  },

  logSheet: {
    title: 'What do you want to log?',
    weight: 'Log weight',
    water: 'Log water',
    activity: 'Log activity',
    waterGoal: 'Water goal',
    food: 'Log food',
    search: 'Find a food',
    manualEntry: 'Manual entry',
    aiCapture: 'Snap or describe (AI)',
    weightLabel: 'Weight ({unit})',
    weightError: 'Enter a weight between 0 and 500 kg.',
    waterLabel: 'How much water?',
    waterGoalLabel: 'Daily water goal (ml)',
    save: 'Save',
    openA11y: 'Open the logging sheet',
  },

  settings: {
    title: 'Settings',
    ringColorsRow: 'Ring colors explained',
  },

  questTitles: {
    log_all_meals: 'Stay consistent',
    hit_calorie_goal: 'Calorie balance',
    drink_water: 'Stay hydrated',
    stay_active_week: 'Keep the streak',
  },

  questDescriptions: {
    log_all_meals: 'Log meals {target} times today',
    hit_calorie_goal: 'Reach {percent}% of your calorie goal',
    drink_water: 'Drink {target} cups of water today',
    stay_active_week: 'Stay active {target} days this week',
  },

  interstitial: {
    title: "That's tasty progress!",
    continue: 'Continue',
    hideProgress: 'Hide challenge progress',
    coinsA11y: '+{count} reward points',
  },

  achievements: {
    title: 'Challenges',
    dailyHeading: 'Daily',
    weeklyHeading: 'Weekly',
    daysLeft: '{days}d left',
    todayLeft: 'Ends today',
    emptyTitle: 'Achievements coming soon',
    emptyDescription: 'Streaks, quests and badges will show up here.',
  },

  shop: {
    title: 'Shop',
    emptyTitle: 'Shop coming soon',
    emptyDescription: 'Spend your reward points on items — coming soon.',
  },

  premium: {
    heroTitle: 'Unlock FoodFen Premium',
    heroSubtitle: 'Deeper, more personalized nutrition tracking.',
    benefitFiberTitle: 'Full fiber breakdown',
    benefitFiberBody: "See every day's fiber, not just calories and macros.",
    benefitCustomTitle: 'Log any ingredient',
    benefitCustomBody: "Enter exact macros for foods that aren't in the catalog.",
    benefitEarlyTitle: 'First access to new features',
    benefitEarlyBody: 'Every future Premium feature, unlocked for you first.',
    benefitSupportTitle: 'Support FoodFen',
    benefitSupportBody: 'Help fund the team improving the app every week.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    perMonth: '/month',
    perYear: '/year',
    bestValue: 'Best value',
    continueButton: 'Continue',
    finePrint: 'Cancel anytime.',
  },

  premiumPayment: {
    layoutTitle: 'Payment',
    orderSummary: 'Order summary',
    totalToday: 'Total today',
    subscribeButton: 'Pay with PayOS',
    terms: "Payment is processed by PayOS. You'll be taken to PayOS's secure checkout page.",
    waitingTitle: 'Waiting for payment confirmation',
    waitingDescription: 'This can take a moment after you finish on PayOS.',
    checkStatus: 'Check again',
    checkoutFailed: "The checkout didn't go through. Please try again.",
    successTitle: 'Welcome to Premium!',
    successMessage: 'Your account has been upgraded.',
    unavailableTitle: 'Payment unavailable',
    unavailableDescription:
      'This feature needs an account and a connection. Sign in from Profile to use it.',
    signIn: 'Sign in',
  },

  streak: {
    title: 'Day Streak',
    viewStreak: 'View streak',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',
    days: 'days',
    noStreakYet: 'Log something today to start your streak.',
    share: 'Share',
    shareMessage: "I'm on a {days}-day streak on FoodFen! 🔥",
    commit: "I'm committed",
    committedToday: "You're committed today ✓",
    heatmapHeading: 'Your effort',
    heatmapLess: 'Less',
    heatmapMore: 'More',
  },

  insights: {
    title: 'Insights',
    dailyAverage: 'Daily average',
    loggingStreak: 'Logging streak',
    dayUnit: 'days',
    windowHeading: 'Last {days} days',
    daysLoggedOf: '{logged} of {total} logged',
    emptyTitle: 'Nothing to chart yet',
    emptyDescription:
      'Log a few days of meals and your trends will show up here.',
    againstGoalHeading: 'Against your goal',
    averageDeficit: 'On an average logged day you ate under your target.',
    averageSurplus: 'On an average logged day you ate over your target.',
    averageMacrosHeading: 'Average macros',
    caloriesByMealHeading: 'Calories by meal',
    onOrUnderGoal: 'On or under goal',
    overGoal: 'Over goal',
    notLogged: 'Not logged',
    targetLegend: 'Target',
    weightTrendHeading: 'Weight trend',
    weightLegend: 'Weight',
    goalLegend: 'Goal',
    goalValue: 'Goal: {weight} kg',
  },

  notFound: {
    layoutTitle: 'Not found',
    title: 'This screen does not exist',
    description: 'The link you followed may be broken or the page may have moved.',
    action: 'Go to your diary',
  },

  dataError: {
    title: 'Could not open your data',
    description: 'The local database failed to prepare: {message}',
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

  targetMode: {
    title: 'Target calculation',
    modeAuto: 'Auto',
    modeManual: 'Manual',
  },

  smartMode: {
    title: 'Smart mode',
    modeSmart: 'Smart',
    modeAllCalories: 'All calories',
    explainerLink: 'How it affects daily calories',
    intro:
      "Smart mode decides whether exercise you log adds back to today's calories left. It doesn't change your calorie target itself — that's set separately under Target calculation.",
    smartHeading: 'Smart',
    smartDescription:
      "Your activity level already accounts for typical daily movement, so logged exercise doesn't add back to your calorie budget — it just tracks the activity itself.",
    allCaloriesHeading: 'All calories',
    allCaloriesDescription:
      "Every workout you log adds its calories back to today's budget, on top of your target.",
  },

  healthSync: {
    heading: 'Step sync',
    caption:
      "Reads today's step count from Health Connect / Apple Health to estimate extra calories burned.",
    permissionDenied: 'Could not get permission. You can re-enable it from system Settings.',
  },

  notifications: {
    mealRemindersHeading: 'Meal reminders',
    mealRemindersCaption:
      "Reminds you to log a meal around your usual time, if it hasn't been logged yet today.",
    streakRemindersHeading: 'Streak reminders',
    streakRemindersCaption:
      "Reminds you before your streak breaks, if you haven't logged anything today.",
    permissionDenied:
      'Could not get notification permission. You can turn it on again in system Settings.',
    mealBreakfastTitle: "Where's breakfast? 🍳",
    mealBreakfastBody: "You haven't logged breakfast yet today.",
    mealLunchTitle: 'Had lunch yet? 🍜',
    mealLunchBody: "You haven't logged lunch yet today.",
    mealDinnerTitle: 'What about dinner? 🍽️',
    mealDinnerBody: "You haven't logged dinner yet today.",
    streakRiskTitle: "🔥 Don't lose your streak",
    streakRiskBody: "You're on a {days}-day streak — log something before today ends.",
  },

  tabs: {
    home: 'Home',
    achievements: 'Achievements',
    insights: 'Stats',
  },

  developer: {
    heading: 'Developer',
    seedData: 'Seed recent days',
    on: 'On',
    off: 'Off',
  },

  chat: {
    layoutTitle: 'AI Assistant',
    inputPlaceholder: 'Ask the assistant...',
    unavailableTitle: 'Chat is unavailable',
    unavailableDescription:
      'This feature needs an account and a connection. Sign in from Profile to use it.',
    signIn: 'Sign in',
  },
};
