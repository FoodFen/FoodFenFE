import type { RemoteNutritionTip } from '@/api/schemas';

/**
 * Offline fallback for the AI wait screen's rotating tips, used until (or
 * unless) `GET /nutrition-tips` has been cached. Short, mainstream facts only.
 */
export const BUNDLED_NUTRITION_TIPS: RemoteNutritionTip[] = [
  {
    id: 'cola-sugar',
    textEn:
      'A 330 ml can of regular cola has about 35 g of sugar, above the WHO ideal limit of 25 g a day.',
    textVi:
      'Một lon cola 330 ml có khoảng 35 g đường, vượt mức lý tưởng 25 g/ngày mà WHO khuyến nghị.',
  },
  {
    id: 'energy-per-gram',
    textEn: 'Protein and carbs give 4 kcal per gram, fat 9 kcal, alcohol 7 kcal.',
    textVi: 'Đạm và tinh bột cho 4 kcal mỗi gam, chất béo 9 kcal, cồn 7 kcal.',
  },
  {
    id: 'salt',
    textEn: 'WHO recommends less than 5 g of salt a day, about one teaspoon.',
    textVi: 'WHO khuyến nghị dưới 5 g muối mỗi ngày, khoảng một muỗng cà phê.',
  },
  {
    id: 'fruit-veg',
    textEn:
      'Adults are advised to eat at least 400 g (5 portions) of fruit and vegetables a day.',
    textVi: 'Người lớn nên ăn ít nhất 400 g (5 phần) rau củ quả mỗi ngày.',
  },
  {
    id: 'fibre',
    textEn: 'About 25 g of fibre a day helps you feel full and keeps digestion regular.',
    textVi: 'Khoảng 25 g chất xơ mỗi ngày giúp no lâu và hỗ trợ tiêu hóa.',
  },
  {
    id: 'rice-bowl',
    textEn: 'A bowl of cooked white rice (about 150 g) is roughly 200 kcal.',
    textVi: 'Một chén cơm trắng (khoảng 150 g) có khoảng 200 kcal.',
  },
  {
    id: 'cooking-oil',
    textEn:
      'One tablespoon of cooking oil is about 120 kcal, and it is easy to miss when logging.',
    textVi: 'Một muỗng canh dầu ăn khoảng 120 kcal và rất dễ bị bỏ sót khi ghi nhật ký.',
  },
  {
    id: 'juice-fibre',
    textEn: 'Fruit juice loses most of the fibre that whole fruit has.',
    textVi: 'Nước ép trái cây mất phần lớn chất xơ so với trái cây nguyên quả.',
  },
  {
    id: 'water-before-meals',
    textEn:
      'Drinking a glass of water before a meal can help you notice fullness sooner.',
    textVi: 'Uống một ly nước trước bữa ăn có thể giúp bạn nhận ra cảm giác no sớm hơn.',
  },
  {
    id: 'eat-slowly',
    textEn: 'Fullness signals take about 20 minutes to arrive, so eating slowly helps.',
    textVi: 'Tín hiệu no cần khoảng 20 phút để đến não, nên ăn chậm sẽ có lợi.',
  },
  {
    id: 'weigh-food',
    textEn:
      'Weighing food beats eyeballing it: estimates are often off by 20 to 30 percent.',
    textVi:
      'Cân thực phẩm chính xác hơn ước lượng bằng mắt, vì ước lượng thường lệch 20 đến 30%.',
  },
  {
    id: 'sleep-appetite',
    textEn: 'Poor sleep tends to raise your appetite the next day.',
    textVi: 'Thiếu ngủ thường làm bạn thèm ăn nhiều hơn vào ngày hôm sau.',
  },
  {
    id: 'kg-fat',
    textEn: 'One kilogram of body fat stores roughly 7,700 kcal.',
    textVi: 'Một kilogram mỡ cơ thể tích trữ khoảng 7.700 kcal.',
  },
  {
    id: 'milk-tea',
    textEn: 'A sweetened milk tea with toppings can carry 300 kcal or more per cup.',
    textVi: 'Một ly trà sữa có đường và topping có thể chứa từ 300 kcal trở lên.',
  },
  {
    id: 'pho-bo',
    textEn:
      'A bowl of beef pho is about 400 to 500 kcal, much of it from broth fat and noodles.',
    textVi:
      'Một tô phở bò khoảng 400 đến 500 kcal, phần lớn đến từ mỡ trong nước dùng và bánh phở.',
  },
];
