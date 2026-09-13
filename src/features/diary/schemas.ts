import { z } from 'zod';

/**
 * What a person may type into a diary form.
 *
 * `manualEntrySchema` backs the manual aggregate-entry screen (UC-12): the
 * user types the final totals with no ingredient breakdown. `amount` /
 * `amountUnit` are a label for how much was eaten and are stored verbatim, with
 * no conversion or scaling.
 */

const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

export const manualEntrySchema = z.object({
  name: z.string().trim().min(1),
  amount: z.number().min(0).nullable(),
  amountUnit: z.enum(['g', 'serving']),
  kcal: z.number().int().min(1).max(20000),
  carbsG: z.number().min(0).max(2000).transform(oneDecimal),
  proteinG: z.number().min(0).max(2000).transform(oneDecimal),
  fatG: z.number().min(0).max(2000).transform(oneDecimal),
});

export type ManualEntryValues = z.infer<typeof manualEntrySchema>;
