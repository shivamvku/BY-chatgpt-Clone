import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, streamResponse } from '../../shared/api';
import { DEFAULT_MODEL, type Conversation, type Message } from '../../shared/types';

export function useChat(id: string | null, select: (id: string) => void, selectedModel?: string) {
  const queries = useQueryClient(),
    [busy, setBusy] = useState(false),
    [generating, setGenerating] = useState(false),
    [error, setError] = useState(''),
    [leaf, setLeaf] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    running = useRef<string | null>(null),
    submission = useRef(false);
  const retry = useRef<{
    content: string;
    parent: string | null;
    conversation: string;
    key: string;
  } | null>(null);
  const stopRequested = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api<Message[]>(`/conversations/${id}/messages`),
    enabled: !!id,
    refetchInterval: (query) =>
      !busy &&
      query.state.data?.some((row) => ['pending', 'streaming', 'stopping'].includes(row.status))
        ? 1000
        : false,
  });
  async function generate(answer: Message, conversationId: string) {
    running.current = answer.id;
    setGenerating(true);
    stopRequested.current = false;
    setLeaf(answer.id);
    controller.current = new AbortController();
    const key = ['messages', conversationId];
    // Do NOT invalidate here — the cache already has the optimistic user message
    // (new conversation) or the real messages (existing conversation). Invalidating
    // immediately would wipe the optimistic entry and cause a loading flash.
    // The finally block below does the post-stream refresh.
    try {
      await streamResponse(answer.id, controller.current.signal, (kind, value) => {
        if (kind === 'error') {
          setError(value.message);
          toast.error(value.message);
        }
        queries.setQueryData<Message[]>(key, (rows) => {
          const updated = rows?.map((row) =>
            row.id !== answer.id
              ? row
              : {
                  ...row,
                  content: kind === 'delta' ? row.content + value.text : row.content,
                  status:
                    kind === 'delta'
                      ? 'streaming'
                      : kind === 'done'
                        ? (value.status as Message['status'])
                        : kind === 'error'
                          ? 'failed'
                          : row.status,
                },
          );
          // If the answer isn't in the cache yet (first SSE event on a new
          // conversation before the refetch lands), append it.
          if (updated && !updated.find((r) => r.id === answer.id)) {
            return [
              ...updated,
              {
                ...answer,
                content: kind === 'delta' ? value.text : '',
                status:
                  kind === 'delta' ? 'streaming' : kind === 'error' ? 'failed' : answer.status,
              },
            ];
          }
          return updated;
        });
      });
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError' && !stopRequested.current)
        setError((failure as Error).message);
    } finally {
      running.current = null;
      setGenerating(false);
      controller.current = null;
      // Invalidate with refetchType 'none' first so the cache is marked stale
      // without being cleared — this prevents the landing empty state from
      // flashing. Then do a quiet background refetch that won't set isLoading.
      await queries.invalidateQueries({ queryKey: key, refetchType: 'none' });
      void queries.refetchQueries({ queryKey: key, type: 'active' });
      await queries.invalidateQueries({ queryKey: ['history'], refetchType: 'none' });
      void queries.refetchQueries({ queryKey: ['history'], type: 'active' });
      await queries.invalidateQueries({ queryKey: ['usage'], refetchType: 'none' });
      void queries.refetchQueries({ queryKey: ['usage'], type: 'active' });
    }
  }
  async function send(content: string, parentId: string | null, model = selectedModel || DEFAULT_MODEL) {
    if (submission.current) return false;
    submission.current = true;
    setBusy(true);
    setError('');
    try {
      let conversationId = id;
      let isNewConversation = false;
      if (!conversationId) {
        const conversation = await api<Conversation>('/conversations', 'POST', {});
        conversationId = conversation.id;
        isNewConversation = true;
      }
      if (
        !retry.current ||
        retry.current.content !== content ||
        retry.current.parent !== parentId ||
        retry.current.conversation !== conversationId
      ) {
        retry.current = {
          content,
          parent: parentId,
          conversation: conversationId,
          key: crypto.randomUUID(),
        };
      }
      // POST the message BEFORE calling select() so that any error (e.g. 429
      // "Daily allowance reached") is caught here and shown in the current
      // hook instance — not lost when select() triggers a re-render.
      const answer = await api<Message>(`/conversations/${conversationId}/messages`, 'POST', {
        content,
        parent_id: parentId,
        request_id: retry.current.key,
        model,
      });
      retry.current = null;

      if (isNewConversation) {
        // Seed the cache with an optimistic user message before switching
        // active conversation so the UI never flashes a loading spinner.
        const now = Date.now();
        const optimisticUser: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          status: 'complete',
          model,
          parent_id: parentId,
          created_at: now,
          updated_at: now,
        };
        queries.setQueryData<Message[]>(['messages', conversationId], [optimisticUser]);
        select(conversationId);
      } else {
        // For existing conversations, optimistically append the new user
        // message and the pending assistant placeholder to the cache so the
        // UI never flashes the landing empty state while waiting for the
        // server refetch.
        const now = Date.now();
        queries.setQueryData<Message[]>(['messages', conversationId], (rows) => {
          const existing = rows ?? [];
          // Avoid duplicates if the message is already in cache (idempotency retry)
          if (existing.some((r) => r.id === answer.id)) return existing;
          const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            status: 'complete',
            model,
            parent_id: parentId,
            created_at: now,
            updated_at: now,
          };
          const assistantPlaceholder: Message = {
            ...answer,
            content: '',
          };
          return [...existing, userMsg, assistantPlaceholder];
        });
      }

      if (answer.status !== 'pending') {
        setLeaf(answer.id);
        await queries.invalidateQueries({ queryKey: ['messages', conversationId] });
        setBusy(false);
        submission.current = false;
        return true;
      }
      void generate(answer, conversationId).finally(() => {
        setBusy(false);
        submission.current = false;
      });
      return true;
    } catch (failure) {
      const msg = (failure as Error).message;
      setError(msg);
      toast.error(msg);
      // Also invalidate usage so the sidebar bar reflects the current state
      void queries.invalidateQueries({ queryKey: ['usage'] });
      setBusy(false);
      submission.current = false;
      return false;
    }
  }
  async function regenerate(message: Message, model = selectedModel || message.model || DEFAULT_MODEL) {
    if (!id || submission.current) return;
    submission.current = true;
    setBusy(true);
    setError('');
    try {
      const answer = await api<Message>(
        `/conversations/${id}/messages/${message.id}/regenerate`,
        'POST',
        { request_id: crypto.randomUUID(), model },
      );
      await generate(answer, id);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      submission.current = false;
    }
  }
  async function stop() {
    if (!running.current) return;
    stopRequested.current = true;
    try {
      await api(`/generations/${running.current}/stop`, 'POST');
      controller.current?.abort();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function stopMessage(message: Message) {
    if (running.current === message.id) {
      await stop();
      return;
    }
    try {
      await api(`/generations/${message.id}/stop`, 'POST');
      await queries.invalidateQueries({ queryKey: ['messages', id] });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return {
    messages,
    busy,
    generating,
    error,
    setError,
    leaf,
    setLeaf,
    send,
    regenerate,
    stop,
    stopMessage,
  };
}
