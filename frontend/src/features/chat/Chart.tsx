import { Box, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '@mui/material/styles';
export function parseChart(
  text: string,
): { title: string; data: { label: string; value: number }[] } | null {
  try {
    const value = JSON.parse(text);
    if (
      !Array.isArray(value.data) ||
      value.data.length < 1 ||
      value.data.length > 50 ||
      !value.data.every(
        (point: { label: unknown; value: unknown }) =>
          typeof point.label === 'string' &&
          point.label.length <= 80 &&
          typeof point.value === 'number' &&
          Number.isFinite(point.value),
      )
    )
      return null;
    return {
      title: typeof value.title === 'string' ? value.title.slice(0, 120) : 'Chart',
      data: value.data,
    };
  } catch {
    return null;
  }
}
export default function Chart({ text }: { text: string }) {
  const theme = useTheme(),
    chart = parseChart(text);
  if (!chart) return <code>{text}</code>;
  return (
    <Box role="figure" aria-label={chart.title} my={2}>
      <Typography fontWeight={700}>{chart.title}</Typography>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chart.data} accessibilityLayer>
          <CartesianGrid stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="label" stroke={theme.palette.text.secondary} />
          <YAxis stroke={theme.palette.text.secondary} />
          <Tooltip
            contentStyle={{
              background: theme.palette.background.paper,
              borderColor: theme.palette.divider,
            }}
          />
          <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <details>
        <summary>View chart data</summary>
        <table>
          <tbody>
            {chart.data.map((point, index) => (
              <tr key={index}>
                <th>{point.label}</th>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Box>
  );
}
