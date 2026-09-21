import type { BmiCategory } from '@/lib/nutrition';
import type { ActivityLevel, DietType, MealType } from '@/types/models';

/**
 * The default dictionary. Vietnamese is the app's primary language — every
 * key must exist here, since `translate()` falls back to this dictionary
 * whenever another locale is missing one.
 *
 * Namespaces are flat (namespace → key → string) rather than deeply nested:
 * `translate()` only resolves one level, so a value that needs a number
 * spliced in (an amount, a unit) carries a `{placeholder}` that the caller
 * replaces itself — there is no template engine here, just a `.replace()` at
 * the call site. A namespace keyed by an enum (`activityLevel`, `dietType`,
 * `bmiCategory`) is `satisfies Record<Enum, string>` so a missing case is a
 * compile error rather than a silent fallback to Vietnamese.
 */
export const vi = {
  common: {
    continue: 'Tiếp tục',
    back: 'Quay lại',
    skip: 'Bỏ qua',
    save: 'Lưu',
    cancel: 'Hủy',
    done: 'Xong',
    retry: 'Thử lại',
    enable: 'Bật',
    delete: 'Xóa',
    name: 'Tên',
    premium: 'Cao cấp',
    dismiss: 'Đóng',
    calories: 'Calo',
    water: 'Nước',
    somethingWentWrong: 'Đã có lỗi xảy ra',
    pleaseTryAgain: 'Vui lòng thử lại.',
  },

  onboardingGender: {
    title: 'Giới tính của bạn là gì?',
    subtitle: 'Điều này giúp cá nhân hóa mục tiêu calo hằng ngày của bạn.',
    male: 'Nam',
    female: 'Nữ',
    // The onboarding chip and the profile summary phrase the same enum value
    // differently in English ("Prefer not to answer" vs "Other"), so both
    // keys are kept rather than reusing one for the other.
    preferNotToAnswer: 'Không muốn trả lời',
    other: 'Khác',
  },

  onboardingBirthYear: {
    title: 'Bạn sinh năm nào?',
    subtitle: 'Tuổi tác ảnh hưởng đến lượng calo cơ thể bạn cần mỗi ngày.',
  },

  onboardingNotifications: {
    title: 'Duy trì thói quen',
    subtitle:
      'Chúng tôi có thể nhắc bạn ghi nhật ký bữa ăn và ăn mừng chuỗi ngày liên tục. Bạn có thể thay đổi điều này bất cứ lúc nào trong Cài đặt.',
  },

  onboardingUnitSystem: {
    title: 'Bạn dùng đơn vị đo nào?',
    subtitle: 'Áp dụng cho mọi số đo trong ứng dụng.',
    metric: 'Hệ mét (cm, kg)',
    imperial: 'Hệ Anh (ft/in, lb)',
  },

  onboardingHeight: {
    title: 'Chiều cao của bạn là bao nhiêu?',
    subtitle: 'Đừng lo, bạn có thể thay đổi điều này bất cứ lúc nào.',
  },

  onboardingWeight: {
    title: 'Cân nặng hiện tại của bạn là bao nhiêu?',
    subtitle: 'Đừng lo, bạn có thể thay đổi điều này bất cứ lúc nào.',
  },

  onboardingActivity: {
    title: 'Bạn vận động nhiều như thế nào?',
    subtitle: 'Điều này giúp ước tính lượng calo bạn đốt mỗi ngày.',
  },

  onboardingGoal: {
    title: 'Cân nặng mục tiêu của bạn là bao nhiêu?',
    subtitle: 'Giữ nguyên như hiện tại nếu bạn chỉ muốn duy trì.',
    maintain: 'Duy trì',
    goalWeightLabel: 'Cân nặng mục tiêu',
  },

  onboardingRate: {
    titleLose: 'Bạn muốn giảm cân nhanh như thế nào?',
    titleGain: 'Bạn muốn tăng cân nhanh như thế nào?',
    subtitleLose: 'Bạn cần giảm {amount} {unit} để đạt mục tiêu',
    subtitleGain: 'Bạn cần tăng {amount} {unit} để đạt mục tiêu',
    paceLabel: '{amount} {unit} mỗi tuần',
    slowLoss: 'Giảm chậm',
    slowGain: 'Tăng chậm',
    moderateLoss: 'Giảm vừa phải',
    moderateGain: 'Tăng vừa phải',
    fastLoss: 'Giảm nhanh',
    fastGain: 'Tăng nhanh',
    tooSlowMessage: 'Tốc độ quá chậm có thể làm giảm động lực.',
    safeMessage: 'Tốc độ an toàn và bền vững cho sức khỏe.',
    reasonableMessage: 'Tốc độ hợp lý, phù hợp với mục tiêu của bạn.',
    tooFastMessage: 'Tốc độ quá nhanh có thể ảnh hưởng đến sức khỏe.',
  },

  onboardingFinalize: {
    creatingPlan: 'Đang tạo kế hoạch của bạn…',
    calculatingBmi: 'Đang tính chỉ số BMI của bạn…',
    gettingInsights: 'Đang tìm hiểu thêm về mục tiêu của bạn…',
    calculationComplete: 'Đã xong!',
    title: 'Chúc mừng bạn!',
    subtitle: 'Kế hoạch sức khỏe cá nhân của bạn đã sẵn sàng.',
    etaMessage: 'Bạn có thể đạt {weight} {unit} vào {date}',
    editAnytime: 'Bạn có thể chỉnh sửa điều này bất cứ lúc nào',
    carbs: 'Tinh bột',
    protein: 'Đạm',
    fat: 'Chất béo',
    yourBmi: 'Chỉ số BMI của bạn',
    yourWeightIs: 'Cân nặng của bạn thuộc mức',
    kcalPerDay: 'kcal / ngày',
    getStarted: 'Bắt đầu',
  },

  // Mirrors `ActivityLevel` in `src/types/models.ts` (re-exported from the
  // Drizzle schema) — one entry per enum value, checked by `satisfies` below.
  activityLevel: {
    sedentary: 'Ít vận động',
    light: 'Nhẹ nhàng',
    moderate: 'Vừa phải',
    active: 'Năng động',
    very_active: 'Rất năng động',
  } satisfies Record<ActivityLevel, string>,

  // Previously packed into `ACTIVITY_LABELS` as `"Title — description"` and
  // split with `.split(' — ')` — fragile once translated, since punctuation
  // and word order aren't guaranteed to match across languages. Kept as its
  // own namespace instead.
  activityLevelDescription: {
    sedentary: 'Ít hoặc không tập thể dục',
    light: '1–3 ngày mỗi tuần',
    moderate: '3–5 ngày mỗi tuần',
    active: '6–7 ngày mỗi tuần',
    very_active: 'Tập luyện cường độ cao hoặc công việc chân tay',
  } satisfies Record<ActivityLevel, string>,

  dietType: {
    balanced: 'Cân bằng',
    low_carb: 'Ít tinh bột',
    high_protein: 'Nhiều đạm',
    keto: 'Keto',
    vegetarian: 'Ăn chay',
  } satisfies Record<DietType, string>,

  // Shared by the onboarding finalize screen (both the "Your weight is X"
  // line and the four band captions) and, going forward, anywhere else a BMI
  // category is shown — one definition instead of one per screen.
  bmiCategory: {
    underweight: 'Thiếu cân',
    healthy: 'Khỏe mạnh',
    overweight: 'Thừa cân',
    obese: 'Béo phì',
  } satisfies Record<BmiCategory, string>,

  profileBodyStats: {
    aboutYou: 'Về bạn',
    sex: 'Giới tính',
    yearOfBirth: 'Năm sinh',
    heightCm: 'Chiều cao (cm)',
    weight: 'Cân nặng',
    currentKg: 'Hiện tại (kg)',
    goalKg: 'Mục tiêu (kg)',
    goalHint: 'Giống cân nặng hiện tại nghĩa là duy trì.',
    paceLabel: 'Tốc độ — kg mỗi tuần',
    activity: 'Vận động',
    diet: 'Chế độ ăn',
    dietHint: 'Thay đổi cách phân bổ calo giữa đạm, tinh bột và chất béo.',
    birthYearError: 'Nhập năm sinh hợp lệ.',
    birthYearTooYoungError: 'Bạn phải từ 13 tuổi trở lên.',
    heightError: 'Nhập chiều cao của bạn theo cm.',
    weightCurrentError: 'Nhập cân nặng của bạn theo kg.',
    weightGoalError: 'Nhập cân nặng mục tiêu theo kg.',
    paceRequiredError: 'Chọn tốc độ bạn muốn đạt được mục tiêu.',
  },

  profileLanguage: {
    heading: 'Ngôn ngữ',
    vietnamese: 'Tiếng Việt',
    english: 'English',
  },

  // Mirrors `MealType` — shared by the entry detail screen, the meal
  // composer, and Insights' per-meal breakdown.
  mealType: {
    breakfast: 'Bữa sáng',
    lunch: 'Bữa trưa',
    dinner: 'Bữa tối',
    snack: 'Ăn vặt',
  } satisfies Record<MealType, string>,

  profile: {
    title: 'Hồ sơ',
    yourAccount: 'Tài khoản của bạn',
    guest: 'Khách',
    trackingOffline: 'Đang theo dõi ngoại tuyến trên thiết bị này',
    signInToSync: 'Đăng nhập để đồng bộ dữ liệu',
    offlineNotice:
      'Mọi thứ đã hoạt động ngoại tuyến. Tài khoản giúp sao lưu nhật ký của bạn và dùng được trên thiết bị khác.',
    change: 'thay đổi',
    changes: 'thay đổi',
    savedOnDeviceOnly: 'chỉ được lưu trên thiết bị này',
    dailyTargets: 'Mục tiêu hằng ngày',
    editGoals: 'Chỉnh sửa mục tiêu và chỉ số cơ thể',
    targetsManual: 'Đặt thủ công — các giá trị này ghi đè lên giá trị tính toán.',
    targetsAuto: 'Tính từ hồ sơ của bạn. Mức duy trì khoảng {kcal} kcal mỗi ngày.',
    age: 'Tuổi',
    height: 'Chiều cao',
    appearance: 'Giao diện',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    themeSystem: 'Theo hệ thống',
    units: 'Đơn vị',
    kilograms: 'Kilôgam',
    pounds: 'Pound',
    challengeProgress: 'Tiến độ thử thách',
    challengeProgressCaption:
      'Hiện màn hình thử thách sau khi ghi bữa ăn, hoạt động hoặc nước uống.',
    signOut: 'Đăng xuất',
    signOutMessage: 'Nhật ký của bạn vẫn ở lại trên thiết bị này.',
    eraseLocalData: 'Xóa dữ liệu trên thiết bị',
    eraseMessage:
      'Thao tác này sẽ xóa vĩnh viễn nhật ký, mục tiêu và hồ sơ của bạn khỏi thiết bị này. Không thể hoàn tác.',
    eraseConfirm: 'Xóa',
  },

  goals: {
    layoutTitle: 'Mục tiêu',
    whatWouldBeCalculated: 'Giá trị sẽ được tính',
    yourNewTargets: 'Mục tiêu mới của bạn',
    manualWarning:
      'Bạn đang dùng mục tiêu thủ công ({kcal} kcal), nên các giá trị tính toán này chưa được áp dụng.',
    switchToCalculated: 'Chuyển sang mục tiêu tính toán',
    useCalculatedTitle: 'Dùng mục tiêu tính toán',
    useCalculatedMessage:
      'Mục tiêu của bạn sẽ được tính từ chỉ số cơ thể và mục tiêu của bạn, áp dụng từ hôm nay trở đi.',
    useCalculatedConfirm: 'Dùng giá trị tính toán',
  },

  auth: {
    signInTitle: 'Đăng nhập',
    createAccountTitle: 'Tạo tài khoản',
    welcomeBack: 'Chào mừng trở lại',
    signInSubtitle:
      'Không bắt buộc — nhật ký của bạn đã hoạt động ngoại tuyến. Tài khoản giúp sao lưu và dùng được trên các thiết bị khác.',
    email: 'Email',
    password: 'Mật khẩu',
    invalidCredentials: 'Email và mật khẩu không khớp.',
    genericError: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    newToApp: 'Mới dùng FoodFen?',
    createAccountLink: 'Tạo tài khoản',
    createYourAccount: 'Tạo tài khoản của bạn',
    signUpSubtitle:
      'Dù thế nào nhật ký của bạn vẫn ở lại trên thiết bị này. Tài khoản là thứ giúp nó theo bạn sang thiết bị khác.',
    passwordHint: 'Ít nhất 8 ký tự, bao gồm một chữ số.',
    confirmPassword: 'Xác nhận mật khẩu',
    alreadyHaveAccount: 'Đã có tài khoản?',
    emailInvalidError: 'Nhập một địa chỉ email hợp lệ.',
    passwordRequiredError: 'Nhập mật khẩu của bạn.',
    displayNameRequiredError: 'Cho chúng tôi biết nên gọi bạn là gì.',
    passwordMinLengthError: 'Dùng ít nhất {count} ký tự.',
    passwordNeedsDigitError: 'Bao gồm ít nhất một chữ số.',
    passwordsMismatchError: 'Mật khẩu không khớp.',
    orDivider: 'hoặc',
  },

  entryDetail: {
    layoutTitle: 'Bữa ăn',
    loadError: 'Không thể tải bữa ăn này.',
    deleteConfirmMessage: 'Xóa bữa ăn này khỏi nhật ký của bạn?',
    at: 'lúc',
    caloriesMacros: 'Calo & Dinh dưỡng',
    edit: 'Sửa',
    total: 'Tổng',
    fiber: 'Chất xơ',
    ingredients: 'Nguyên liệu',
    noBreakdown: 'Bữa ăn này được ghi lại mà không có chi tiết thành phần.',
    wasThisRight: 'Điều này có đúng không?',
    aiFeedbackHint: 'Câu trả lời của bạn giúp cải thiện cách đọc bữa ăn.',
    looksRight: 'Đúng rồi',
    notQuite: 'Chưa đúng',
    deleteMealButton: 'Xóa bữa ăn',
  },

  entryEdit: {
    layoutTitle: 'Sửa món',
    loadError: 'Không thể tải bữa ăn này.',
    name: 'Tên món',
    mealType: 'Bữa ăn',
    calories: 'Calo',
    macros: 'Chất dinh dưỡng',
    carbs: 'Tinh bột',
    protein: 'Đạm',
    fat: 'Chất béo',
    reconcileWarning: 'Calo không khớp với tổng các chất dinh dưỡng.',
    multiIngredientNote: 'Món có nhiều nguyên liệu chỉ sửa được tên và bữa ăn ở đây.',
    save: 'Lưu',
    saveErrorTitle: 'Không thể lưu thay đổi',
    saveErrorFallback: 'Vui lòng thử lại.',
  },

  logMeal: {
    layoutTitle: 'Ghi bữa ăn',
    mealNameLabel: 'Tên bữa ăn',
    mealNameHint: 'Không bắt buộc — chúng tôi sẽ đặt tên theo nguyên liệu.',
    mealLabel: 'Bữa ăn',
    emptyHint:
      'Thêm những gì có trong bữa ăn này. Chọn từ danh sách có sẵn, hoặc tự nhập.',
    removeIngredientA11y: 'Xóa {name}',
    lowConfidenceA11y: 'AI đoán — kiểm tra lại mục này',
    addIngredientA11y: 'Thêm nguyên liệu',
    addIngredientLabel: '+ Thêm nguyên liệu',
    saveToDiary: 'Lưu vào nhật ký',
    saveErrorTitle: 'Không thể lưu bữa ăn này',
    saveErrorFallback: 'Vui lòng thử lại.',
  },

  logIngredient: {
    layoutTitle: 'Thêm nguyên liệu',
    searchPlaceholder: 'Tìm món ăn',
    clearSearchA11y: 'Xóa tìm kiếm',
    foodA11y: '{name}, {kcal} kcal mỗi 100 gram',
    kcalPer100g: '{kcal} kcal / 100 g',
    noMatches: 'Không có kết quả',
    noMatchesDescription: 'Không có trong danh sách có sẵn cho “{query}”.',
    searchHint: 'Tìm trong danh sách món ăn có sẵn, hoặc tự nhập một món.',
    enterYourOwn: 'Tự nhập',
    premiumHint:
      'Tự nhập nguyên liệu là tính năng Cao cấp. Mọi thứ trong danh sách có sẵn vẫn miễn phí.',
    backToSearch: '← Quay lại tìm kiếm',
    amount: 'Số lượng',
    amountError: 'Nhập số lượng lớn hơn 0.',
    serving: 'Khẩu phần',
    calories: 'Calo',
    weight: 'Khối lượng',
    weightGrams: 'Khối lượng (g)',
    addToMeal: 'Thêm vào bữa ăn',
  },

  logSearch: {
    layoutTitle: 'Tìm món ăn',
    searchPlaceholder: 'Phở, trà sữa, cơm tấm…',
    clearSearchA11y: 'Xóa tìm kiếm',
    recentHeading: 'Gần đây',
    searchHint: 'Nhập ít nhất 2 ký tự để tìm món ăn.',
    noMatches: 'Không tìm thấy món nào',
    noMatchesDescription: 'Không có kết quả cho “{query}”.',
    perServing: '{kcal} kcal / {serving}',
    foodA11y: '{name}, {kcal} kcal',
    recentA11y: '{name}, ghi lại khẩu phần gần nhất',
    amount: 'Số lượng',
    serving: 'Khẩu phần',
    add: 'Thêm',
    addErrorTitle: 'Không thể ghi món này',
  },

  logManual: {
    layoutTitle: 'Nhập chi tiết',
    mealName: 'Tên món',
    chooseEmojiA11y: 'Chọn biểu tượng cảm xúc cho món ăn',
    mealNamePlaceholder: 'ví dụ: Phở bò',
    smartEntry: 'Mô tả bằng một câu (AI)',
    smartEntryPlaceholder: 'ví dụ: Một tô phở bò, nhiều rau thơm',
    smartEntryAnalyze: 'Phân tích',
    aiAnalyzePhoto: 'Phân tích ảnh',
    aiRetakePhoto: 'Chọn ảnh khác',
    aiTakePhoto: 'Chụp ảnh',
    aiChooseFromLibrary: 'Chọn từ thư viện',
    aiImageHint: 'Chụp hoặc chọn ảnh món ăn, AI sẽ ước tính thành phần trong đó.',
    aiErrorTitle: 'Không thể phân tích',
    aiErrorFallback: 'Vui lòng thử lại.',
    aiUnavailableTitle: 'Chưa thể dùng AI',
    aiUnavailableDescription:
      'Tính năng này cần tài khoản và kết nối mạng. Đăng nhập từ Hồ sơ để sử dụng.',
    aiSignIn: 'Đăng nhập',
    comingSoon: 'Sắp có',
    suggestionsA11y: 'Gợi ý món ăn',
    pickSuggestionA11y: '{name}, điền số liệu từ danh sách có sẵn',
    amountEaten: 'Lượng đã ăn',
    grams: 'Gram',
    serving: 'Khẩu phần',
    calories: 'Calo',
    macros: 'Chất dinh dưỡng',
    carbs: 'Tinh bột',
    protein: 'Đạm',
    fat: 'Chất béo',
    gramSuffix: 'g',
    reconcileWarning:
      'Calo nhập vào lệch khá nhiều so với tổng từ tinh bột, đạm và chất béo.',
    save: 'Lưu',
    saveErrorTitle: 'Không thể lưu món này',
    saveErrorFallback: 'Vui lòng thử lại.',
    modeVoice: 'Giọng nói',
    modeImage: 'Hình ảnh',
    modeManual: 'Nhập tay',
  },

  logActivity: {
    layoutTitle: 'Hoạt động',
    presetHeading: 'Chọn hoạt động',
    kcalPer30Min: '{kcal} kcal / 30 phút',
    pickPresetA11y: '{name}, {kcal} kcal mỗi 30 phút',
    durationLabel: 'Thời lượng',
    customMinutes: 'Tuỳ chỉnh (phút)',
    minutesSuffix: 'phút',
    timeLabel: 'Thời điểm',
    now: 'Bây giờ',
    pickTime: 'Chọn giờ',
    freeTextLabel: 'Nhập bài tập của bạn (ví dụ: đạp xe 45 phút)',
    save: 'Lưu',
    saveErrorTitle: 'Không thể lưu hoạt động này',
  },

  activityPresets: {
    walking: 'Đi bộ',
    running: 'Chạy bộ',
    cycling: 'Đạp xe',
    elliptical: 'Máy tập elliptical',
    swimming: 'Bơi lội',
    strength: 'Tập tạ',
  },

  dashboard: {
    pointsA11y: '{count} điểm thưởng',
    openShop: 'Mở cửa hàng',
    openSettings: 'Mở cài đặt',
    openChat: 'Mở trợ lý AI',
    // Summary card
    target: 'Mục tiêu',
    consumed: 'Đã nạp',
    burned: 'Đã đốt',
    carbs: 'Tinh bột',
    protein: 'Đạm',
    fat: 'Chất béo',
    fiber: 'Chất xơ',
    sugar: 'Đường',
    sodium: 'Natri',
    comingSoon: 'Sắp có',
    // Sections
    caloriesEaten: 'Calo đã ăn',
    caloriesBurned: 'Calo đã đốt',
    steps: 'Bước chân',
    noWorkouts: 'Chưa có bài tập nào',
    burnGoal: 'Mục tiêu: {kcal} kcal',
    water: 'Nước',
    waterGoal: 'Mục tiêu: {ml} ml',
    fiberDailyLevel: 'Mức hằng ngày',
    viewFiberIntake: 'Xem lượng chất xơ của bạn',
    weight: 'Cân nặng',
    weightGoal: 'Mục tiêu: {weight} kg',
    weightToGo: 'Còn {delta} kg nữa',
    weightReached: 'Đã đạt mục tiêu',
    logFirstMeal: 'Ghi bữa ăn đầu tiên của bạn!',
    kcalLeft: 'Còn {kcal} kcal',
    kcalOver: 'Vượt {kcal} kcal',
    addA11y: 'Thêm',
    viewEntriesA11y: 'Xem các món đã ghi',
    editWaterGoalA11y: 'Đổi mục tiêu nước',
    backToToday: 'Hôm nay',
    moreEntries: '+{count}',
    dayLoadError: 'Không tải được ngày này.',
  },

  dayEntries: {
    empty: 'Chưa ghi món nào trong ngày này.',
  },

  logSheet: {
    title: 'Bạn muốn ghi lại điều gì?',
    weight: 'Ghi cân nặng',
    water: 'Ghi lượng nước',
    food: 'Ghi bữa ăn',
    activity: 'Ghi hoạt động',
    waterGoal: 'Mục tiêu nước',
    search: 'Tìm món ăn',
    manualEntry: 'Nhập chi tiết',
    aiCapture: 'Chụp hoặc mô tả (AI)',
    weightLabel: 'Cân nặng ({unit})',
    weightError: 'Nhập cân nặng từ 0 đến 500 kg.',
    waterLabel: 'Bao nhiêu nước?',
    waterGoalLabel: 'Mục tiêu nước mỗi ngày (ml)',
    save: 'Lưu',
    openA11y: 'Mở bảng ghi nhật ký',
  },

  settings: {
    title: 'Cài đặt',
    ringColorsRow: 'Giải thích màu vòng tròn',
  },

  questTitles: {
    log_all_meals: 'Duy trì thói quen',
    hit_calorie_goal: 'Cân bằng calo',
    drink_water: 'Uống đủ nước',
    stay_active_week: 'Giữ chuỗi ngày',
  },

  questDescriptions: {
    log_all_meals: 'Ghi {target} bữa ăn hôm nay',
    hit_calorie_goal: 'Đạt {percent}% mục tiêu calo của bạn',
    drink_water: 'Uống {target} cốc nước hôm nay',
    stay_active_week: 'Hoạt động {target} ngày trong tuần này',
  },

  interstitial: {
    title: 'Tiến triển ngon lành!',
    continue: 'Tiếp tục',
    hideProgress: 'Ẩn tiến độ thử thách',
    coinsA11y: '+{count} điểm thưởng',
  },

  achievements: {
    title: 'Thử thách',
    dailyHeading: 'Hằng ngày',
    weeklyHeading: 'Hằng tuần',
    daysLeft: 'Còn {days} ngày',
    todayLeft: 'Hết hạn hôm nay',
    emptyTitle: 'Thành tích sắp ra mắt',
    emptyDescription: 'Chuỗi ngày, nhiệm vụ và huy hiệu sẽ xuất hiện ở đây.',
  },

  shop: {
    title: 'Cửa hàng',
    emptyTitle: 'Cửa hàng sắp ra mắt',
    emptyDescription: 'Dùng điểm thưởng để mở khóa vật phẩm — sắp có.',
  },

  streak: {
    title: 'Chuỗi ngày',
    viewStreak: 'Xem chuỗi ngày',
    currentStreak: 'Chuỗi hiện tại',
    longestStreak: 'Chuỗi dài nhất',
    days: 'ngày',
    noStreakYet: 'Ghi lại hôm nay để bắt đầu chuỗi ngày của bạn.',
    share: 'Chia sẻ',
    shareMessage: 'Tôi đang duy trì chuỗi {days} ngày trên FoodFen! 🔥',
    commit: 'Tôi cam kết',
    committedToday: 'Bạn đã cam kết hôm nay ✓',
  },

  insights: {
    title: 'Thống kê',
    dailyAverage: 'Trung bình ngày',
    loggingStreak: 'Chuỗi ngày ghi',
    dayUnit: 'ngày',
    windowHeading: '{days} ngày qua',
    daysLoggedOf: 'Đã ghi {logged}/{total} ngày',
    emptyTitle: 'Chưa có dữ liệu để vẽ biểu đồ',
    emptyDescription:
      'Ghi lại vài ngày ăn uống, xu hướng của bạn sẽ xuất hiện ở đây.',
    againstGoalHeading: 'So với mục tiêu',
    averageDeficit: 'Trung bình mỗi ngày đã ghi, bạn ăn ít hơn mục tiêu.',
    averageSurplus: 'Trung bình mỗi ngày đã ghi, bạn ăn nhiều hơn mục tiêu.',
    averageMacrosHeading: 'Dinh dưỡng trung bình',
    caloriesByMealHeading: 'Calo theo bữa',
    onOrUnderGoal: 'Đạt/dưới mục tiêu',
    overGoal: 'Vượt mục tiêu',
    notLogged: 'Chưa ghi',
    targetLegend: 'Mục tiêu',
    weightTrendHeading: 'Xu hướng cân nặng',
    weightLegend: 'Cân nặng',
    goalLegend: 'Mục tiêu',
    goalValue: 'Mục tiêu: {weight} kg',
  },

  notFound: {
    layoutTitle: 'Không tìm thấy',
    title: 'Trang này không tồn tại',
    description: 'Liên kết bạn vừa mở có thể đã hỏng hoặc đã được chuyển đi.',
    action: 'Về nhật ký của bạn',
  },

  dataError: {
    title: 'Không mở được dữ liệu của bạn',
    description: 'Không chuẩn bị được cơ sở dữ liệu trên máy: {message}',
  },

  ringColors: {
    title: 'Giải thích màu vòng tròn',
    intro:
      'Trên lịch ở trang chủ, vòng tròn màu quanh mỗi ngày cho biết bạn đã gần với mục tiêu calo hằng ngày như thế nào:',
    under: 'Đen',
    underDescription: 'Thấp hơn mục tiêu hơn 500 kcal',
    green: 'Xanh lá',
    greenDescription: 'Vượt không quá 100 calo so với mục tiêu của bạn',
    yellow: 'Vàng',
    yellowDescription: 'Vượt 100–200 calo so với mục tiêu',
    red: 'Đỏ',
    redDescription: 'Vượt hơn 200 calo so với mục tiêu',
    faint: 'Mờ',
    faintDescription: 'Không ghi bữa ăn nào ngày đó',
  },

  weekStrip: {
    previousWeek: 'Tuần trước',
    nextWeek: 'Tuần sau',
  },

  targetMode: {
    title: 'Cách tính mục tiêu',
    modeAuto: 'Tự động',
    modeManual: 'Thủ công',
  },

  smartMode: {
    title: 'Chế độ thông minh',
    modeSmart: 'Thông minh',
    modeAllCalories: 'Cộng mọi calo',
    explainerLink: 'Ảnh hưởng đến calo hằng ngày thế nào',
    intro:
      'Chế độ thông minh quyết định calo vận động bạn ghi lại có được cộng ngược vào lượng calo còn lại hôm nay hay không. Nó không thay đổi mục tiêu calo của bạn — mục tiêu được đặt riêng ở mục Cách tính mục tiêu.',
    smartHeading: 'Thông minh',
    smartDescription:
      'Mức vận động của bạn đã tính đến hoạt động thường ngày, nên calo vận động bạn ghi lại không được cộng ngược vào ngân sách calo — chỉ được ghi nhận như một hoạt động.',
    allCaloriesHeading: 'Cộng mọi calo',
    allCaloriesDescription:
      'Mỗi buổi tập bạn ghi lại đều được cộng ngược vào ngân sách calo hôm nay, thêm vào mục tiêu của bạn.',
  },

  tabs: {
    home: 'Trang chủ',
    achievements: 'Thử thách',
    insights: 'Thống kê',
  },

  developer: {
    heading: 'Nhà phát triển',
    seedData: 'Tạo dữ liệu mẫu cho vài ngày gần đây',
    on: 'Bật',
    off: 'Tắt',
  },

  chat: {
    layoutTitle: 'Trợ lý AI',
    inputPlaceholder: 'Hỏi trợ lý...',
    unavailableTitle: 'Trò chuyện chưa khả dụng',
    unavailableDescription:
      'Tính năng này cần tài khoản và kết nối mạng. Đăng nhập trong Hồ sơ để sử dụng.',
    signIn: 'Đăng nhập',
  },
} as const;

export type Translations = typeof vi;
