import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../shared/api';

interface Plan {
  id: string;
  name: string;
  daily_requests: number;
  daily_tokens: number;
  version: number;
}
function PlanEditor({ plan }: { plan: Plan }) {
  const queries = useQueryClient(),
    [requests, setRequests] = useState(plan.daily_requests),
    [tokens, setTokens] = useState(plan.daily_tokens),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/plans/${plan.id}`, 'PATCH', {
        daily_requests: requests,
        daily_tokens: tokens,
      });
      await queries.invalidateQueries({ queryKey: ['plans'] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={1}>
      <Typography variant="body2" fontWeight={700}>
        {plan.name} · policy v{plan.version}
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label={`${plan.name} daily requests`}
        type="number"
        value={requests}
        onChange={(e) => setRequests(Number(e.target.value))}
        inputProps={{ min: 0, max: 1000 }}
      />
      <TextField
        label={`${plan.name} daily tokens`}
        type="number"
        value={tokens}
        onChange={(e) => setTokens(Number(e.target.value))}
        inputProps={{ min: 0, max: 1000000 }}
      />
      <Button disabled={busy} onClick={() => void save()}>
        Save {plan.name} limits
      </Button>
    </Stack>
  );
}
export function PlanPanel() {
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/admin/plans') });
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<{ id: string; action: string; created_at: number }[]>('/admin/audit'),
  });
  return (
    <Stack spacing={3}>
      <Typography fontWeight={700}>Plan allowances</Typography>
      <Typography variant="caption">
        Application-wide safety limits still apply. The daily token allowance is shared by all
        subscription members.
      </Typography>
      {plans.isError && <Alert severity="error">{plans.error.message}</Alert>}
      {plans.data?.map((plan) => (
        <PlanEditor key={`${plan.id}-${plan.version}`} plan={plan} />
      ))}
      <Typography fontWeight={700}>Audit events</Typography>
      {audit.isError && <Alert severity="error">{audit.error.message}</Alert>}
      {audit.data?.slice(0, 20).map((event) => (
        <Typography key={event.id} variant="caption">
          {new Date(event.created_at * 1000).toLocaleString()} · {event.action}
        </Typography>
      ))}
    </Stack>
  );
}
