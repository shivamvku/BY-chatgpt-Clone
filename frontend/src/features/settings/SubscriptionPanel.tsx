import { useQuery } from '@tanstack/react-query';
import { Alert, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { api } from '../../shared/api';
import type { Subscription } from '../../shared/types';
import { SeatPanel } from './SeatPanel';

interface UsageEvent {
  id: string;
  model: string;
  reserved_tokens: number;
  status: string;
  created_at: number;
}

export function SubscriptionPanel() {
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<Subscription>('/subscription'),
  });
  if (subscription.isPending) return <LinearProgress aria-label="Loading subscription" />;
  if (subscription.isError) return <Alert severity="error">{subscription.error.message}</Alert>;
  const data = subscription.data;
  return (
    <Stack spacing={2}>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip label={data.plan_name} color="primary" />
        <Chip label={data.status} />
      </Stack>
      <Typography variant="body2">
        {data.members} / {data.seats} seats · one active browser session per person.
      </Typography>
      <Typography variant="body2">
        Chat and file retention:{' '}
        {data.retention_days === null
          ? 'Until deletion or account closure'
          : `${data.retention_days} days`}
        . Storage allowance: {Math.round(data.storage_bytes / 1024 / 1024)} MB.
      </Typography>
      <Typography variant="body2">
        {data.expires_at
          ? `Subscription ends ${new Date(data.expires_at * 1000).toLocaleDateString()}.`
          : 'No subscription expiry is assigned.'}
      </Typography>
      <Alert severity="info">
        This subscription is assigned by an administrator. Payment collection and invoices are not
        enabled.
      </Alert>
      {data.owner && data.seats > 1 && <SeatPanel />}
    </Stack>
  );
}

export function UsageEventsPanel() {
  const events = useQuery({
    queryKey: ['usage-events'],
    queryFn: () => api<UsageEvent[]>('/usage/events'),
  });
  if (events.isPending) return <LinearProgress aria-label="Loading usage" />;
  if (events.isError) return <Alert severity="error">{events.error.message}</Alert>;
  if (events.data.length === 0)
    return (
      <Typography variant="body2" color="text.secondary">
        No AI requests yet.
      </Typography>
    );
  return (
    <Stack spacing={1}>
      {events.data.slice(0, 10).map((event) => (
        <Typography key={event.id} variant="body2">
          {new Date(event.created_at * 1000).toLocaleString()} · {event.model} ·{' '}
          {event.reserved_tokens.toLocaleString()} reserved tokens · {event.status}
        </Typography>
      ))}
    </Stack>
  );
}
