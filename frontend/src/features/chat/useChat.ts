import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, streamResponse } from '../../shared/api';
import type { Conversation, Message } from '../../shared/types';

export function useChat(id: string | null, select: (id: string) => void) {
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
    await queries.invalidateQueries({ queryKey: key });
    try {
      await streamResponse(answer.id, controller.current.signal, (kind, value) => {
        if (kind === 'error') setError(value.message);
        queries.setQueryData<Message[]>(key, (rows) =>
          rows?.map((row) =>
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
          ),
        );
      });
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError' && !stopRequested.current)
        setError((failure as Error).message);
    } finally {
      running.current = null;
      setGenerating(false);
      controller.current = null;
      await queries.invalidateQueries({ queryKey: key });
      await queries.invalidateQueries({ queryKey: ['history'] });
      await queries.invalidateQueries({ queryKey: ['usage'] });
    }
  }
  async function send(content: string, parentId: string | null, model = 'gemini-flash') {
    if (submission.current) return false;
    submission.current = true;
    setBusy(true);
    setError('');
    try {
      let conversationId = id;
      if (!conversationId) {
        const conversation = await api<Conversation>('/conversations', 'POST', {});
        conversationId = conversation.id;
        select(conversationId);
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
      const answer = await api<Message>(`/conversations/${conversationId}/messages`, 'POST', {
        content,
        parent_id: parentId,
        request_id: retry.current.key,
        model,
      });
      retry.current = null;
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
      setError((failure as Error).message);
      setBusy(false);
      submission.current = false;
      return false;
    }
  }
  async function regenerate(message: Message, model = message.model || 'gemini-flash') {
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
