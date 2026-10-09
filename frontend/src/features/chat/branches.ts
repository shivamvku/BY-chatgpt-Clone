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
  return result;
}
export function siblings(messages: Message[], message: Message) {
  return messages.filter((row) => row.parent_id === message.parent_id && row.role === message.role);
}
