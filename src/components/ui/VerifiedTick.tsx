import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/** Green tick marking a catalog food whose nutrition is cited to a source. */
export function VerifiedTick({
  verified,
  size = 16,
}: {
  verified?: boolean;
  size?: number;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();

  if (!verified) return null;

  return (
    <Ionicons
      name="checkmark-circle"
      size={size}
      color={colorsFor(resolved).success}
      accessibilityLabel={t('common', 'verifiedSource')}
    />
  );
}
