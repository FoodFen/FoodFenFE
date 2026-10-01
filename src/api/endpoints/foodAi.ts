import { File } from 'expo-file-system';

import { api } from '@/api/client';
import { getDeviceId } from '@/api/deviceId';
import { aiFoodAnalysisResponseSchema, aiQuotaResponseSchema } from '@/api/schemas';
import type { RemoteAiFoodAnalysisResponse, RemoteAiQuotaResponse } from '@/api/schemas';
import { useSettingsStore } from '@/features/settings/store';

/**
 * AI food recognition.
 *
 * Both paths return the same shape — a suggested meal name plus itemized
 * ingredient rows — so the caller can hand the result straight to the
 * existing meal draft (`useDraftStore`) regardless of which input method was
 * used. See `docs/backend-contracts/ai-food-capture.md` for the full wire
 * contract this is built against.
 */
// A full vision/LLM pass legitimately runs past the app's default 15s
// request timeout (see docs/backend-contracts/ai-food-capture.md) — without
// this, a slow-but-successful analysis gets aborted client-side and
// misread as a failure.
const AI_ANALYSIS_TIMEOUT_MS = 60_000;

const deviceHeaders = async () => ({ 'X-Device-Id': await getDeviceId() });

export const foodAiApi = {
  analyzeImage: async (
    uri: string,
    fileName: string,
  ): Promise<RemoteAiFoodAnalysisResponse> => {
    const form = new FormData();
    // Expo SDK 57's global `fetch` (`expo/fetch`) only accepts a real
    // Blob-like part (string | Blob | { bytes() }) in FormData — React
    // Native's classic `{ uri, name, type }` shape throws "Unsupported
    // FormDataPart implementation". `File` implements that Blob interface.
    form.append('image', new File(uri), fileName);
    // So the model responds in the user's language instead of a mix — see
    // docs/backend-contracts/ai-food-capture.md.
    form.append('language', useSettingsStore.getState().locale);

    return api.post('ai/food/analyze-image', undefined, {
      formData: form,
      headers: await deviceHeaders(),
      schema: aiFoodAnalysisResponseSchema,
      timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
    });
  },

  getQuota: async (): Promise<RemoteAiQuotaResponse> =>
    api.get('ai/food/quota', {
      headers: await deviceHeaders(),
      schema: aiQuotaResponseSchema,
    }),

  analyzeText: async (
    description: string,
    inputMethod: 'text' | 'voice' = 'text',
  ): Promise<RemoteAiFoodAnalysisResponse> =>
    api.post(
      'ai/food/analyze-text',
      { description, language: useSettingsStore.getState().locale, inputMethod },
      {
        headers: await deviceHeaders(),
        schema: aiFoodAnalysisResponseSchema,
        timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
      },
    ),
};
