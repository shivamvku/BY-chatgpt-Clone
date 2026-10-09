import type { ReactNode } from 'react';
import { Paper, Stack, Typography } from '@mui/material';

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography fontWeight={700}>{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

export function SettingRow({
  label,
  description,
  control,
}: {
  label?: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 1.5, sm: 2 }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
    >
      <Stack spacing={0.25}>
        {label && (
          <Typography variant="body2" fontWeight={600}>
            {label}
          </Typography>
        )}
        {description && (
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        )}
      </Stack>
      {control}
    </Stack>
  );
}
