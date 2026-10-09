import { useState } from 'react';
import { Alert, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../shared/api';
import { useAuth } from './AuthProvider';
import { AuthScreen } from './AuthScreen';
import { VerificationScreen } from './VerificationScreen';

export interface AccountLink {
  purpose: 'verify' | 'reset' | 'transfer' | 'invite';
  token: string;
}

export function readAccountLink(): AccountLink | null {
  const match = window.location.hash.match(
    /^#account\/(verify|reset|transfer|invite)\/([A-Za-z0-9_-]{40,100})$/,
  );
  if (!match) return null;
  // Remove sensitive fragments immediately; retain the token only in component memory.
  window.history.replaceState(null, '', window.location.pathname);
  return { purpose: match[1] as AccountLink['purpose'], token: match[2] };
}
export const initialAccountLink = readAccountLink();

export function AccountAction({ link, onClose }: { link: AccountLink; onClose: () => void }) {
  const { authenticate, refresh, user } = useAuth();
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      if (link.purpose === 'transfer') {
        await authenticate('transfer/confirm', { token: link.token });
        onClose();
      } else if (link.purpose === 'invite') {
        const result = await api<{ message: string }>('/subscription/invitations/accept', 'POST', {
          token: link.token,
        });
        setNotice(result.message);
      } else {
        const result = await api<{ message: string }>(
          link.purpose === 'verify' ? '/auth/verification/confirm' : '/auth/password/reset',
          'POST',
          { token: link.token, ...(link.purpose === 'reset' ? { password } : {}) },
        );
        setNotice(result.message);
        await refresh();
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (link.purpose === 'invite' && !user) return <AuthScreen />;
  if (link.purpose === 'invite' && !user?.verified_user) return <VerificationScreen />;
  return (
    <Container maxWidth="sm">
      <Stack justifyContent="center" minHeight="100dvh">
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Typography variant="h5" fontWeight={700}>
              {link.purpose === 'reset'
                ? 'Set a new password'
                : link.purpose === 'verify'
                  ? 'Verify your email'
                  : link.purpose === 'invite'
                    ? 'Accept subscription invitation'
                    : 'Confirm sign-in transfer'}
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}
            {link.purpose === 'transfer' && (
              <Typography>This signs out your previous device and signs you in here.</Typography>
            )}
            {link.purpose === 'reset' && !notice && (
              <TextField
                type="password"
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Use at least 10 characters."
                inputProps={{ minLength: 10, maxLength: 128 }}
              />
            )}
            {!notice && (
              <Button
                variant="contained"
                disabled={busy || (link.purpose === 'reset' && password.length < 10)}
                onClick={() => void confirm()}
              >
                Confirm
              </Button>
            )}
            <Button disabled={busy} onClick={onClose}>
              Continue to YounderChat
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
