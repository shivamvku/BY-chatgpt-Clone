import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../../shared/api';
import type { User, Usage } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { useAppearance } from '../../theme/AppearanceProvider';
import { AppearanceControls } from './AppearanceControls';
import { AdminPanel } from '../admin/AdminPanel';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser, logout } = useAuth(),
    appearance = useAppearance(),
    queries = useQueryClient();
  const [name, setName] = useState(user?.name || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const usage = useQuery({
    queryKey: ['usage'],
    queryFn: () => api<Usage>('/usage'),
    enabled: open,
  });
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () =>
      api<{ created_at: number; expires_at: number; current: boolean }[]>('/auth/sessions'),
    enabled: open,
  });
  const images = useQuery({
    queryKey: ['images'],
    queryFn: () => api<{ id: string; name: string; size: number }[]>('/files'),
    enabled: open,
  });
  async function removeImage(id: string) {
    setError('');
    try {
      await api(`/files/${id}`, 'DELETE');
      await queries.invalidateQueries({ queryKey: ['images'] });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      updateUser(
        await api<User>('/auth/profile', 'PATCH', {
          name,
          appearance: appearance.appearance,
          contrast: appearance.contrast,
        }),
      );
      setSaved(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut(all: boolean) {
    setBusy(true);
    try {
      await logout(all);
      onClose();
      queries.clear();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          {saved && <Alert severity="success">Preferences saved</Alert>}
          <TextField
            label="Display name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            inputProps={{ maxLength: 80 }}
          />
          <Typography variant="body2" color="text.secondary">
            {user?.email} · {user?.role}
          </Typography>
          <AppearanceControls />
          <Button variant="contained" disabled={busy || !name.trim()} onClick={() => void save()}>
            Save profile and appearance
          </Button>
          <Divider />
          <Typography fontWeight={700}>Daily AI allowance</Typography>
          {usage.data && (
            <Typography variant="body2">
              {usage.data.requests} / {usage.data.request_limit} requests ·{' '}
              {usage.data.reserved_tokens.toLocaleString()} /{' '}
              {usage.data.token_limit.toLocaleString()} reserved tokens. Resets at midnight UTC.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Tokens are reserved conservatively before generation, including failed and stopped
            attempts.
          </Typography>
          <Typography fontWeight={700}>Stored images</Typography>
          <Typography variant="caption" color="text.secondary">
            Deleting an image removes it from messages that reference it.
          </Typography>
          {images.data?.map((image) => (
            <Stack key={image.id} direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" flex={1}>
                {image.name} · {Math.ceil(image.size / 1024)} KB
              </Typography>
              <Button size="small" color="error" onClick={() => void removeImage(image.id)}>
                Delete image
              </Button>
            </Stack>
          ))}
          <Typography fontWeight={700}>Sessions</Typography>
          {sessions.data?.map((session, index) => (
            <Typography variant="body2" key={index}>
              {session.current ? 'This session' : 'Other session'} · expires{' '}
              {new Date(session.expires_at * 1000).toLocaleDateString()}
            </Typography>
          ))}
          <Stack direction="row" gap={1}>
            <Button disabled={busy} onClick={() => void signOut(false)}>
              Sign out
            </Button>
            <Button color="error" disabled={busy} onClick={() => void signOut(true)}>
              Sign out all devices
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Password recovery and email verification are pending email-provider integration.
          </Typography>
          {user?.role === 'admin' && (
            <>
              <Divider />
              <AdminPanel />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
