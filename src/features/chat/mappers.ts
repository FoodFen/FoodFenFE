import type { IMessage } from '@kesha-antonov/react-native-chat';

import type { RemoteChatMessage } from '@/api/schemas';

/**
 * Fixed participants — this is always a one-on-one conversation with the
 * assistant, never a group chat, so there is no per-conversation user list
 * to look up.
 */
export const CHAT_USER = { _id: 'user' };
export const CHAT_ASSISTANT = { _id: 'assistant' };

export function toIMessage(message: RemoteChatMessage): IMessage {
  return {
    _id: message.id,
    text: message.content,
    createdAt: new Date(message.createdAt),
    user: message.role === 'user' ? CHAT_USER : CHAT_ASSISTANT,
  };
}
