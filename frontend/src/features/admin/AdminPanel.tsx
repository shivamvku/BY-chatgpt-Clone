import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Stack, Typography, MenuItem, TextField } from '@mui/material';
import { api } from '../../shared/api';
import type { User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { PlanPanel } from './PlanPanel';
export function AdminPanel() {
  const { user } = useAuth(),
    queries = useQueryClient(),
    [after, setAfter] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const users = useQuery({
    queryKey: ['admin-users', after],
    queryFn: () => api<User[]>(`/admin/users?after=${after}`),
  });
  async function update(row: User, values: Partial<User>) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${row.id}`, 'PATCH', {
        role: row.role,
        active: row.active,
        ...values,
      });
      await queries.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assign(id: string, plan: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${id}/subscription`, 'PATCH', { plan, status: 'active' });
      await queries.invalidateQueries({ queryKey: ['subscription'] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={2}>
      <Typography fontWeight={700}>User administration</Typography>
      {(error || users.isError) && (
        <Alert severity="error">{error || 'Could not load users'}</Alert>
      )}
      {users.data?.map((row) => (
        <Box key={row.id}>
          <Typography variant="body2">
            {row.name} · {row.email}
            {row.verified_user ? ' · Verified' : ' · Unverified'}
          </Typography>
          <Stack direction="row" gap={1}>
            <Button
              size="small"
              disabled={busy || row.id === user?.id}
              onClick={() =>
                void update(row, {
                  role: row.role === 'admin' ? 'user' : 'admin',
                })
              }
            >
              {row.role === 'admin' ? 'Make user' : 'Make admin'}
            </Button>
            <Button
              size="small"
              color="error"
              disabled={busy || row.id === user?.id}
              onClick={() => void update(row, { active: !row.active })}
            >
              {row.active ? 'Disable' : 'Enable'}
            </Button>
          </Stack>
          <TextField
            select
            size="small"
            label={`Assign plan for ${row.name}`}
            value=""
            disabled={busy}
            onChange={(e) => void assign(row.id, e.target.value)}
            sx={{ mt: 1, minWidth: 200 }}
          >
            <MenuItem value="basic">Basic</MenuItem>
            <MenuItem value="pro">Pro</MenuItem>
            <MenuItem value="pro_max">Pro Max</MenuItem>
          </TextField>
        </Box>
      ))}
      <Stack direction="row">
        <Button disabled={!after} onClick={() => setAfter('')}>
          First page
        </Button>
        <Button
          disabled={!users.data || users.data.length < 30}
          onClick={() => setAfter(users.data?.at(-1)?.id || '')}
        >
          Next page
        </Button>
      </Stack>
      <PlanPanel />
    </Stack>
  );
}
