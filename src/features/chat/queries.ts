import { useInfiniteQuery } from '@tanstack/react-query';

import { chatApi } from '@/api/endpoints/chat';
import { queryKeys } from '@/lib/queryClient';

/**
 * The single conversation's history, oldest page loaded on demand as the
 * user scrolls back. `getNextPageParam` reads the cursor the server handed
 * back on the previous page — see `docs/superpowers/specs/2026-09-19-ai-chat-design.md`
 * for the contract.
 */
export function useChatHistory() {
  return useInfiniteQuery({
    queryKey: queryKeys.chat.history(),
    queryFn: ({ pageParam }) => chatApi.getHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
