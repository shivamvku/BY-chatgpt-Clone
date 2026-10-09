import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useAuth } from './AuthProvider';
import { AppearanceControls } from '../settings/AppearanceControls';

export function AuthScreen() {
  const { authenticate, error: sessionError, refresh } = useAuth();
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authenticate(register ? 'register' : 'login', {
        email,
        password,
        ...(register ? { name } : {}),
      });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container maxWidth="lg">
      <Stack minHeight="100dvh" justifyContent="center" spacing={4} py={4}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={{ xs: 4, md: 10 }} alignItems="center">
          <Box flex={1}>
            <Typography fontWeight={800} color="primary" variant="h5" mb={5}>
              YounderChat
            </Typography>
            <Typography
              variant="h3"
              fontWeight={750}
              sx={{ letterSpacing: '-.04em', maxWidth: 520 }}
            >
              A clearer path
              <br />
              from question
              <br />
              to possibility.
            </Typography>
            <Typography color="text.secondary" mt={3} maxWidth={430}>
              One thoughtful conversation at a time. Your ideas, your history, your space to
              explore.
            </Typography>
            <Box mt={4}>
              <AppearanceControls />
            </Box>
          </Box>
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, width: '100%', maxWidth: 440 }}>
            <Typography variant="h5" fontWeight={700}>
              {register ? 'Create your account' : 'Welcome back'}
            </Typography>
            <Typography color="text.secondary" mt={1} mb={2}>
              Continue your conversation with YounderChat.
            </Typography>
            <Tabs
              value={register ? 1 : 0}
              onChange={(_, value) => {
                setRegister(value === 1);
                setError('');
              }}
            >
              <Tab label="Sign in" />
              <Tab label="Create account" />
            </Tabs>
            <Stack component="form" onSubmit={submit} spacing={2.5} mt={3}>
              {sessionError && (
                <Alert
                  severity="error"
                  action={<Button onClick={() => void refresh()}>Retry</Button>}
                >
                  {sessionError}
                </Alert>
              )}
              {error && <Alert severity="error">{error}</Alert>}
              {register && (
                <TextField
                  label="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  inputProps={{ maxLength: 80 }}
                />
              )}
              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                inputProps={{ maxLength: 254 }}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                inputProps={{ minLength: 10, maxLength: 128 }}
                helperText={register ? 'Use at least 10 characters.' : undefined}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy || !!sessionError}
              >
                {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Email verification and password recovery are not enabled in this development
                release.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
}
