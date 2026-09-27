import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

import { Text } from './Text';

/**
 * A plain right-aligned numeric field in a rounded container — no −/+ steppers.
 *
 * While focused the field owns a draft string, so a half-typed "1." is not
 * clobbered by a re-render; on blur the draft is parsed, clamped to [min, max]
 * and rounded to `precision` decimals before it flows back out through
 * `onChange`. An empty field reports `null` rather than a number, so callers
 * can tell "not entered yet" from a real `0`.
 */

export interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  /** Decimal places kept when parsing and displaying. Default 0. */
  precision?: number;
  label?: string;
  /** Unit shown after the number — "g", a serving label. */
  suffix?: string;
  placeholder?: string;
  /** A narrow box for a label-beside-input row rather than a full-width field. */
  compact?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  precision = 0,
  label,
  suffix,
  placeholder,
  compact = false,
}: NumberFieldProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const format = (n: number): string =>
    precision > 0 ? n.toFixed(precision) : String(Math.round(n));

  // `null` while not editing — the field then just shows the formatted prop, so
  // a prefill from elsewhere flows straight through. A non-null draft is what
  // the user is typing and is never overwritten mid-type.
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === null ? '' : format(value));

  const roundTo = (n: number): number => {
    const factor = 10 ** precision;

    return Math.round(n * factor) / factor;
  };

  const commit = (raw: string): void => {
    const trimmed = raw.trim();

    if (trimmed === '') {
      onChange(null);
      return;
    }

    const parsed = Number(trimmed.replace(',', '.'));

    onChange(Number.isFinite(parsed) ? clamp(roundTo(parsed), min, max) : value);
  };

  const field = (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-card border border-border bg-surface',
        compact ? 'h-10 w-20 px-2' : 'h-12 flex-1 px-3',
      )}
    >
      <TextInput
        className="h-full flex-1 py-0 text-right font-sans text-base text-fg"
        value={display}
        onChangeText={setDraft}
        onFocus={() => setDraft(value === null ? '' : format(value))}
        onBlur={() => {
          commit(draft ?? '');
          setDraft(null);
        }}
        keyboardType={precision > 0 ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={colors.fgSubtle}
        selectTextOnFocus
        accessibilityLabel={label}
      />
      {suffix && !compact ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );

  if (compact) return field;

  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      {field}
    </View>
  );
}
