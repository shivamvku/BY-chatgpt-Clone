import { useState } from 'react';
import { Alert, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { api } from '../../shared/api';
import { useAuth } from './AuthProvider';
import { AppearanceControls } from '../settings/AppearanceControls';

export function VerificationScreen() {
  const { user, logout, refresh } = useAuth();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  async function resend() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ message: string }>('/auth/verification/request', 'POST', {
        email: user?.email,
      });
      setNotice(result.message);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container maxWidth="sm">
      <Stack minHeight="100dvh" justifyContent="center">
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Typography variant="h5" color="primary" fontWeight={800}>
              YounderChat
            </Typography>
            <Typography variant="h5">Verify your email</Typography>
            <Typography>
              Confirm {user?.email} using the link in your inbox to activate chat and file access.
              Your account starts on Basic.
            </Typography>
            {notice && <Alert severity="info">{notice}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" disabled={busy} onClick={() => void resend()}>
              Resend verification email
            </Button>
            <Button disabled={busy} onClick={() => void refresh()}>
              I have verified my email
            </Button>
            <AppearanceControls />
            <Button disabled={busy} onClick={() => void logout()}>
              Sign out
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
