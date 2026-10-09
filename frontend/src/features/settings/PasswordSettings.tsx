import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../shared/api';
import { useAuth } from '../auth/AuthProvider';

export function PasswordSettings() {
  const { refresh } = useAuth();
  const [oldPassword, setOldPassword] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function change() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/password/change', 'POST', { old_password: oldPassword, password });
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={2}>
      <Typography fontWeight={700}>Change password</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        helperText="At least 10 characters. Changing your password signs out all devices."
      />
      <Button disabled={busy || password.length < 10 || !oldPassword} onClick={() => void change()}>
        Update password
      </Button>
    </Stack>
  );
}
