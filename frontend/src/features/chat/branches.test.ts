import { describe, expect, it } from 'vitest';
import { conversationParent, visibleBranch, siblings } from './branches';
import type { Message } from '../../shared/types';

const row = (id: string, parent_id: string | null, role: Message['role']): Message => ({
  id,
  parent_id,
  role,
  content: id,
  status: 'complete',
  model: '',
  created_at: 0,
  updated_at: 0,
});

describe('conversation branches', () => {
  it('shows only the selected branch and preserves alternate responses', () => {
    const rows = [
      row('u', null, 'user'),
      row('a', 'u', 'assistant'),
      row('b', 'u', 'assistant'),
      row('next', 'b', 'user'),
    ];
    expect(visibleBranch(rows, 'a').map((value) => value.id)).toEqual(['u', 'a']);
    expect(visibleBranch(rows, 'next').map((value) => value.id)).toEqual(['u', 'b', 'next']);
    expect(siblings(rows, rows[1])).toHaveLength(2);
  });

  it('recovers older timelines where each user prompt was saved as a separate root', () => {
    const rows = [
      row('u1', null, 'user'),
      row('a1', 'u1', 'assistant'),
      row('u2', null, 'user'),
      row('a2', 'u2', 'assistant'),
    ];
    expect(visibleBranch(rows).map((value) => value.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(visibleBranch(rows, 'a2').map((value) => value.id)).toEqual([
      'u1',
      'a1',
      'u2',
      'a2',
    ]);
    expect(visibleBranch(rows, 'a1').map((value) => value.id)).toEqual(['u1', 'a1']);
  });

  it('uses the current assistant as the parent for the next prompt', () => {
    const rows = [
      row('u1', null, 'user'),
      row('a1', 'u1', 'assistant'),
      row('u2', 'a1', 'user'),
      row('a2', 'u2', 'assistant'),
    ];
    expect(conversationParent(rows)).toBe('a2');
    expect(conversationParent(rows, 'a1')).toBe('a1');
    expect(conversationParent(rows, 'u2')).toBe('a2');
  });

  it('bounds malformed cycles', () =>
    expect(visibleBranch([row('a', 'b', 'assistant'), row('b', 'a', 'user')], 'a')).toHaveLength(
      2,
    ));
});
