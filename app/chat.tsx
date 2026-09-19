import { Chat, useStreamingMessages } from '@kesha-antonov/react-native-chat';
import type { IMessage } from '@kesha-antonov/react-native-chat';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { streamChatReply } from '@/api/endpoints/chat';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { CHAT_ASSISTANT, CHAT_USER, toIMessage } from '@/features/chat/mappers';
import { useChatHistory } from '@/features/chat/queries';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';

/**
 * The single continuous conversation with the assistant. Gated exactly like
 * every other account feature (`canUseRemote()`) — no offline identity for
 * chat, no local cache of messages (see the design spec).
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const available = canUseRemote();
  // The one reason among the three `canUseRemote()` checks worth a distinct
  // affordance: everything else about the build/connection is fine, only
  // signing in is missing.
  const isNoSessionReason = env.hasBackend && onlineManager.isOnline() && !session;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useChatHistory({
    enabled: available,
  });
  const { messages, append, setMessages, startStream } = useStreamingMessages<IMessage>();

  // `useChatHistory` pages are newest-first, and within a page messages are
  // newest-first too (design spec), so this flattened array is already in
  // the order `useStreamingMessages` keeps internally by default
  // (`inverted: true` — "newest message first", matching `<Chat>`'s own
  // default). No reversal needed.
  const historyMessages = useMemo(
    () => data?.pages.flatMap((page) => page.messages).map(toIMessage) ?? [],
    [data],
  );

  // Seed history as pages arrive, re-seeding only the messages not already
  // seeded (a second page from `fetchNextPage` must not be dropped, and a
  // page that arrives after the user already sent a message must not be
  // seeded as if it were newer). History is always older than anything
  // already in the list, so it is spliced onto the end directly via
  // `setMessages` rather than `append()`, which always prepends its
  // argument as the newest message.
  const seededCountRef = useRef(0);
  useEffect(() => {
    if (historyMessages.length <= seededCountRef.current) return;

    const newlySeeded = historyMessages.slice(seededCountRef.current);
    seededCountRef.current = historyMessages.length;

    setMessages((prev) => [...prev, ...newlySeeded]);
  }, [historyMessages, setMessages]);

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      const outgoing = newMessages[0];
      if (!outgoing) return;

      append(outgoing);
      const stream = startStream({ user: CHAT_ASSISTANT });

      void streamChatReply(outgoing.text, {
        signal: stream.signal,
        onToken: (delta) => stream.push(delta),
        onDone: (message) => {
          stream.done(toIMessage(message));
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
        },
        onError: (message) => stream.done({ text: message }),
      });
    },
    [append, startStream, queryClient],
  );

  if (!available) {
    return (
      <Screen>
        {isNoSessionReason ? (
          <EmptyState
            icon="⚠️"
            title={t('chat', 'unavailableTitle')}
            description={t('chat', 'unavailableDescription')}
            actionLabel={t('chat', 'signIn')}
            onAction={() => router.push('/sign-in')}
          />
        ) : (
          <ErrorState
            title={t('chat', 'unavailableTitle')}
            description={t('chat', 'unavailableDescription')}
          />
        )}
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
        enableGestureHandlerRootView={false}
        loadEarlierMessagesProps={{
          isAvailable: hasNextPage,
          isLoading: isFetchingNextPage,
          onPress: fetchNextPage,
        }}
      />
    </Screen>
  );
}
