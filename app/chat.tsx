import { Chat, useStreamingMessages } from '@kesha-antonov/react-native-chat';
import type { IMessage } from '@kesha-antonov/react-native-chat';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';

import { streamChatReply } from '@/api/endpoints/chat';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { CHAT_ASSISTANT, CHAT_USER, toIMessage } from '@/features/chat/mappers';
import { useChatHistory } from '@/features/chat/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';
import { chatDarkTheme, chatLightTheme } from '@/theme/chatTheme';

/**
 * The single continuous conversation with the assistant. Gated exactly like
 * every other account feature (`canUseRemote()`) — no offline identity for
 * chat, no local cache of messages (see the design spec).
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
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

  // Seed history as pages arrive, re-seeding only messages not already
  // present by id. A plain length/tail-diff isn't safe here: a second page
  // from `fetchNextPage` does grow the flattened array at its tail, but
  // `onDone`'s `invalidateQueries` below can also cause page 0 itself to be
  // refetched with the just-completed exchange inserted at its *head* (this
  // page is newest-first) — a tail-slice would then re-seed already-live
  // messages as if they were new, duplicating them. Comparing ids against
  // the current list via `setMessages`'s functional form is correct
  // regardless of where growth actually lands. Newly-seeded messages are
  // always older than anything already in the list, so they are appended to
  // its end directly via `setMessages` rather than `append()`, which always
  // prepends its argument as the newest message.
  useEffect(() => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((message) => message._id));
      const newlySeeded = historyMessages.filter((message) => !existingIds.has(message._id));

      return newlySeeded.length === 0 ? prev : [...prev, ...newlySeeded];
    });
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
        colorScheme={isDark ? 'dark' : 'light'}
        theme={chatLightTheme}
        darkTheme={chatDarkTheme}
        messageTextProps={{ markdown: true }}
      />
    </Screen>
  );
}
