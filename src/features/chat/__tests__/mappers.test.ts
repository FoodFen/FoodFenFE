import { CHAT_ASSISTANT, CHAT_USER, toIMessage } from '../mappers';

describe('toIMessage', () => {
  it('maps a user message to the CHAT_USER participant', () => {
    const result = toIMessage({
      id: '1',
      role: 'user',
      content: 'How much protein is in an egg?',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result._id).toBe('1');
    expect(result.text).toBe('How much protein is in an egg?');
    expect(result.user).toEqual(CHAT_USER);
    expect(result.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('maps an assistant message to the CHAT_ASSISTANT participant', () => {
    const result = toIMessage({
      id: '2',
      role: 'assistant',
      content: 'About 6 grams.',
      createdAt: '2026-01-01T00:00:01.000Z',
    });

    expect(result.user).toEqual(CHAT_ASSISTANT);
  });
});
