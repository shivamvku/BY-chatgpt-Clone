import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { api } from '../../shared/api';
import type { User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
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
    </Stack>
  );
}
