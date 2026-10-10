import { Chat, useStreamingMessages } from '@kesha-antonov/react-native-chat';
import type { IMessage } from '@kesha-antonov/react-native-chat';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { streamChatReply } from '@/api/endpoints/chat';
import { AiAvatar } from '@/components/chat/AiAvatar';
import { ChatBubble } from '@/components/chat/ChatBubble';
import type { FreshIds } from '@/components/chat/ChatBubble';
import { ChatEmpty } from '@/components/chat/ChatEmpty';
import { ChatHeaderTitle } from '@/components/chat/ChatHeaderTitle';
import { ChatSendButton } from '@/components/chat/ChatSendButton';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { CHAT_ASSISTANT, CHAT_USER, toIMessage } from '@/features/chat/mappers';
import { useChatHistory } from '@/features/chat/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { queryKeys } from '@/lib/queryClient';
import { CHAT_AVATAR_SIZE, chatDarkTheme, chatLightTheme } from '@/theme/chatTheme';

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

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useChatHistory({
    enabled: available,
  });
  const { messages, append, setMessages, startStream, isStreaming } =
    useStreamingMessages<IMessage>();
  const [freshIds] = useState<FreshIds>(() => new Set());
  const [pendingIds] = useState(() => new Set<string | number>());

  // `useChatHistory` pages are newest-first, and within a page messages are
  // newest-first too (design spec), so this flattened array is already in
  // the order `useStreamingMessages` keeps internally by default
  // (`inverted: true` — "newest message first", matching `<Chat>`'s own
  // default). No reversal needed.
  const historyMessages = useMemo(
    () => data?.pages.flatMap((page) => page.messages).map(toIMessage) ?? [],
    [data],
  );

  // Seed history as pages arrive. Messages dedupe by id (a plain tail-diff is
  // unsafe: `onDone`'s `invalidateQueries` can refetch page 0 with the new
  // exchange at its *head*). Exception: the `done` frame returns only the
  // assistant message, never the user message's server id, so our own pending
  // sends are replaced in place by their persisted copy (matched by text,
  // oldest first). Anything else new is older than what is shown, so it goes
  // to the end of the list — via `setMessages`, since `append()` prepends.
  // Replaced ids stay in `pendingIds` but are inert (nothing matches them any
  // more); the updater must not delete them since React may run it twice.
  useEffect(() => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((message) => message._id));
      const next = [...prev];
      let changed = false;

      for (const message of historyMessages) {
        if (existingIds.has(message._id)) continue;
        changed = true;

        let pendingIndex = -1;
        if (message.user._id === CHAT_USER._id) {
          for (let i = next.length - 1; i >= 0; i--) {
            const local = next[i];
            if (local && pendingIds.has(local._id) && local.text === message.text) {
              pendingIndex = i;
              break;
            }
          }
        }

        if (pendingIndex >= 0) next[pendingIndex] = message;
        else next.push(message);
      }

      return changed ? next : prev;
    });
  }, [historyMessages, pendingIds, setMessages]);

  const onSend = useCallback(
    (newMessages: IMessage[] = []) => {
      const outgoing = newMessages[0];
      if (!outgoing) return;

      haptics.selection();
      append(outgoing);
      const stream = startStream({ user: CHAT_ASSISTANT });
      freshIds.add(outgoing._id);
      pendingIds.add(outgoing._id);
      freshIds.add(stream.id);

      void streamChatReply(outgoing.text, {
        signal: stream.signal,
        onToken: (delta) => stream.push(delta),
        onDone: (message) => {
          haptics.success();
          stream.done(toIMessage(message));
          void queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
        },
        onError: (message) => stream.done({ text: message }),
      });
    },
    [append, startStream, freshIds, pendingIds, queryClient],
  );

  const sendSuggestion = useCallback(
    (text: string) =>
      onSend([
        {
          _id: Math.random().toString(36).slice(2),
          text,
          createdAt: new Date(),
          user: CHAT_USER,
        },
      ]),
    [onSend],
  );

  const headerOptions = useMemo(
    () => ({ headerTitle: () => <ChatHeaderTitle typing={isStreaming} /> }),
    [isStreaming],
  );

  if (!available) {
    return (
      <Screen>
        {isNoSessionReason ? (
          <EmptyState
            icon="alert-circle-outline"
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
      <Stack.Screen options={headerOptions} />
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
        renderBubble={(props) => <ChatBubble {...props} freshIds={freshIds} />}
        renderAvatar={() => <AiAvatar size={CHAT_AVATAR_SIZE} />}
        renderSend={(props) => <ChatSendButton {...props} />}
        renderChatEmpty={() => (isLoading ? null : <ChatEmpty onSuggest={sendSuggestion} />)}
      />
    </Screen>
  );
}
