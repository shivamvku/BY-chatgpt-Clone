import { describe, expect, it } from 'vitest';
import { visibleBranch, siblings } from './branches';
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
  it('bounds malformed cycles', () =>
    expect(visibleBranch([row('a', 'b', 'assistant'), row('b', 'a', 'user')], 'a')).toHaveLength(
      2,
    ));
});
