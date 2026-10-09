import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../shared/api';

interface Member {
  id: string;
  name: string;
  email: string;
  owner: boolean;
}
export function SeatPanel() {
  const queries = useQueryClient(),
    [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => api<Member[]>('/subscription/members'),
  });
  async function invite() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ message: string }>('/subscription/invitations', 'POST', { email });
      setNotice(result.message);
      setEmail('');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/subscription/members/${id}`, 'DELETE');
      await queries.invalidateQueries({ queryKey: ['members'] });
      await queries.invalidateQueries({ queryKey: ['subscription'] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={2}>
      <Typography fontWeight={700}>Subscription members</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {members.isError && <Alert severity="error">{members.error.message}</Alert>}
      {notice && <Alert severity="info">{notice}</Alert>}
      {members.data?.map((member) => (
        <Stack key={member.id} direction="row" alignItems="center" gap={1}>
          <Typography variant="body2" flex={1}>
            {member.name} · {member.email}
            {member.owner ? ' · Owner' : ''}
          </Typography>
          {!member.owner && (
            <Button disabled={busy} color="error" onClick={() => void remove(member.id)}>
              Remove
            </Button>
          )}
        </Stack>
      ))}
      <TextField
        label="Invite by email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        helperText="Each member uses their own verified account. Chats and files stay private."
      />
      <Button disabled={busy || !email.includes('@')} onClick={() => void invite()}>
        Send invitation
      </Button>
    </Stack>
  );
}
