import { expect, it } from 'vitest';
import { parseChart } from './Chart';
it('rejects malformed and unbounded chart data', () => {
  expect(parseChart('not json')).toBeNull();
  expect(parseChart('{"data":[{"label":"x","value":"execute"}]}')).toBeNull();
  expect(parseChart(JSON.stringify({ data: Array(51).fill({ label: 'x', value: 1 }) }))).toBeNull();
  expect(parseChart('{"title":"Sales","data":[{"label":"Jan","value":12}]}')?.data[0].value).toBe(
    12,
  );
});
