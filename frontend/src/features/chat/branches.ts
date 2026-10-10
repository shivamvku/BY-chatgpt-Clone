import type { Message } from '../../shared/types';

export function visibleBranch(messages: Message[], leaf?: string | null): Message[] {
  const map = new Map(messages.map((message) => [message.id, message]));
  const result: Message[] = [],
    seen = new Set<string>();
  let current = leaf ? map.get(leaf) : messages.at(-1);
  while (current && !seen.has(current.id)) {
    result.unshift(current);
    seen.add(current.id);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }

  // Older clients submitted every prompt with a null parent, leaving each turn
  // as a separate root. When viewing the latest/default path, recover that
  // legacy timeline in ordinal/API order instead of hiding all earlier turns.
  const rootPrompts = messages.filter((message) => message.role === 'user' && !message.parent_id);
  const latest = messages.at(-1);
  const viewingLatest = !leaf || leaf === latest?.id;
  if (viewingLatest && rootPrompts.length > 1 && result.length < messages.length) {
    return messages;
  }

  return result;
}

export function conversationParent(messages: Message[], leaf?: string | null): string | null {
  const selected = leaf ? messages.find((message) => message.id === leaf) : undefined;

  if (selected?.role === 'assistant') return selected.id;
  if (selected?.role === 'user') {
    const response = messages
      .filter((message) => message.role === 'assistant' && message.parent_id === selected.id)
      .at(-1);
    return response?.id ?? selected.parent_id;
  }

  const latest = messages.at(-1);
  if (latest?.role === 'assistant') return latest.id;
  return [...messages].reverse().find((message) => message.role === 'assistant')?.id ?? null;
}

export function siblings(messages: Message[], message: Message) {
  return messages.filter((row) => row.parent_id === message.parent_id && row.role === message.role);
}
