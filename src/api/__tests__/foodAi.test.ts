import { foodAiApi } from '@/api/endpoints/foodAi';
import { ApiError } from '@/api/errors';

jest.mock('@/lib/env', () => ({
  env: { apiUrl: 'https://api.test', hasBackend: true, apiTimeoutMs: 5000, isDev: false },
}));
jest.mock('expo-file-system', () => ({ File: class {} }));

const fetchMock = jest.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('foodAiApi.analyzeText', () => {
  it('sends the device id, no bearer token and the input method', async () => {
    respond(200, { mealName: 'Pho', ingredients: [] });

    await foodAiApi.analyzeText('a bowl of pho', 'voice');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.test/ai/food/analyze-text');
    expect(headers['X-Device-Id']).toBeTruthy();
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toMatchObject({
      description: 'a bowl of pho',
      inputMethod: 'voice',
    });
  });

  it('defaults the input method to text', async () => {
    respond(200, { mealName: 'Pho', ingredients: [] });

    await foodAiApi.analyzeText('a bowl of pho');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).inputMethod).toBe('text');
  });

  it('reuses the same device id across calls', async () => {
    respond(200, { mealName: '', ingredients: [] });
    respond(200, { mealName: '', ingredients: [] });

    await foodAiApi.analyzeText('one');
    await foodAiApi.analyzeText('two');

    const ids = fetchMock.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)['X-Device-Id'],
    );
    expect(ids[0]).toBe(ids[1]);
  });

  it('maps a 403 with code ai_trial_exhausted to the trial_exhausted kind', async () => {
    respond(403, { message: 'used up', code: 'ai_trial_exhausted', inputMethod: 'text' });

    const error = await foodAiApi.analyzeText('x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('trial_exhausted');
    expect((error as ApiError).status).toBe(403);
  });

  it('keeps a 403 without the trial code as forbidden', async () => {
    respond(403, { message: 'nope' });

    const error = await foodAiApi.analyzeText('x').catch((e: unknown) => e);

    expect((error as ApiError).kind).toBe('forbidden');
  });
});

describe('foodAiApi.getQuota', () => {
  it('parses per-method remaining tries with the device id header', async () => {
    respond(200, {
      unlimited: false,
      image: { limit: 3, remaining: 2 },
      text: { limit: 3, remaining: 3 },
      voice: { limit: 3, remaining: 0 },
    });

    const quota = await foodAiApi.getQuota();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/ai/food/quota');
    expect((init.headers as Record<string, string>)['X-Device-Id']).toBeTruthy();
    expect(quota.image?.remaining).toBe(2);
    expect(quota.voice?.remaining).toBe(0);
  });

  it('parses the unlimited premium shape', async () => {
    respond(200, { unlimited: true, image: null, text: null, voice: null });

    const quota = await foodAiApi.getQuota();

    expect(quota).toEqual({ unlimited: true, image: null, text: null, voice: null });
  });
});
