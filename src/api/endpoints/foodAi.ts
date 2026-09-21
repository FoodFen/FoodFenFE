import { api } from '@/api/client';
import { aiFoodAnalysisResponseSchema } from '@/api/schemas';
import type { RemoteAiFoodAnalysisResponse } from '@/api/schemas';

/**
 * AI food recognition.
 *
 * Both paths return the same shape — a suggested meal name plus itemized
 * ingredient rows — so the caller can hand the result straight to the
 * existing meal draft (`useDraftStore`) regardless of which input method was
 * used. See `docs/backend-contracts/ai-food-capture.md` for the full wire
 * contract this is built against.
 */
export const foodAiApi = {
  analyzeImage: (
    uri: string,
    fileName: string,
    mimeType: string,
  ): Promise<RemoteAiFoodAnalysisResponse> => {
    const form = new FormData();
    // React Native's FormData accepts this `{ uri, name, type }` shape for a
    // file part; the DOM `Blob` type it's cast to here does not describe it.
    form.append('image', { uri, name: fileName, type: mimeType } as unknown as Blob);

    return api.post('ai/food/analyze-image', undefined, {
      formData: form,
      schema: aiFoodAnalysisResponseSchema,
    });
  },

  analyzeText: (description: string): Promise<RemoteAiFoodAnalysisResponse> =>
    api.post(
      'ai/food/analyze-text',
      { description },
      { schema: aiFoodAnalysisResponseSchema },
    ),
};
