import { Chat, useStreamingMessages } from '@kesha-antonov/react-native-chat';
import type { IMessage } from '@kesha-antonov/react-native-chat';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { streamChatReply } from '@/api/endpoints/chat';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { canUseRemote } from '@/data/sync';
import { CHAT_ASSISTANT, CHAT_USER, toIMessage } from '@/features/chat/mappers';
import { useChatHistory } from '@/features/chat/queries';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The single continuous conversation with the assistant. Gated exactly like
 * every other account feature (`canUseRemote()`) — no offline identity for
 * chat, no local cache of messages (see the design spec).
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const available = canUseRemote();

  const { data } = useChatHistory();
  const { messages, append, startStream } = useStreamingMessages<IMessage>();

  // `useChatHistory` pages are newest-first, and within a page messages are
  // newest-first too (design spec), so this flattened array is already in
  // the order `useStreamingMessages` keeps internally by default
  // (`inverted: true` — "newest message first", matching `<Chat>`'s own
  // default). No reversal needed.
  const historyMessages = useMemo(
    () => data?.pages.flatMap((page) => page.messages).map(toIMessage) ?? [],
    [data],
  );

  // Seed history into the hook's own message list once per fetched set.
  // `append` accepts a single message or an array (checked against the
  // installed package's types), so this is one call rather than a loop.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || historyMessages.length === 0) return;

    seededRef.current = true;
    append(historyMessages);
  }, [historyMessages, append]);

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      const outgoing = newMessages[0];
      if (!outgoing) return;

      append(outgoing);
      const stream = startStream({ user: CHAT_ASSISTANT });

      void streamChatReply(String(outgoing.text), {
        signal: stream.signal,
        onToken: (delta) => stream.push(delta),
        onDone: (message) => stream.done(toIMessage(message)),
        onError: (message) => stream.done({ text: message }),
      });
    },
    [append, startStream],
  );

  if (!available) {
    return (
      <Screen>
        <ErrorState
          title={t('chat', 'unavailableTitle')}
          description={t('chat', 'unavailableDescription')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Chat
        messages={messages}
        onSend={onSend}
        user={CHAT_USER}
        labels={{ placeholder: t('chat', 'inputPlaceholder') }}
      />
    </Screen>
  );
}
