import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { api } from '../../shared/api';
import type { SessionView, StoredImage, Subscription, Usage, User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { useAppearance } from '../../theme/AppearanceProvider';
import { AppearanceControls } from './AppearanceControls';
import { SubscriptionPanel, UsageEventsPanel } from './SubscriptionPanel';
import { PasswordSettings } from './PasswordSettings';
import { SectionCard, SettingRow } from './SectionCard';

type SectionId = 'general' | 'appearance' | 'plan' | 'data' | 'security' | 'admin';

interface NavItem {
  id: SectionId;
  label: string;
  hint: string;
  icon: ReactNode;
}

function GeneralSection() {
  const { user, updateUser } = useAuth();
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<Subscription>('/subscription'),
  });
  const appearance = useAppearance();
  const [name, setName] = useState(user?.name || ''),
    [bio, setBio] = useState(user?.bio || ''),
    [timezone, setTimezone] = useState(user?.timezone || 'UTC'),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      updateUser(
        await api<User>('/auth/profile', 'PATCH', {
          name,
          bio,
          timezone,
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
  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" onClose={() => setSaved(false)}>
          Preferences saved
        </Alert>
      )}
      <SectionCard title="Profile" description="Your name, short bio, and timezone.">
        <Stack spacing={2.5}>
          <TextField
            label="Display name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
            inputProps={{ maxLength: 80 }}
          />
          <TextField
            label="Bio"
            multiline
            maxRows={4}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setSaved(false);
            }}
            inputProps={{ maxLength: 500 }}
          />
          <TextField
            label="Timezone"
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              setSaved(false);
            }}
            helperText="For example: Asia/Kolkata or UTC"
            inputProps={{ maxLength: 80 }}
          />
          <Box>
            <Button variant="contained" disabled={busy || !name.trim()} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
        </Stack>
      </SectionCard>
      <SectionCard title="Account" description="Sign-in details for this account.">
        <SettingRow
          label="Email address"
          control={<Typography variant="body2">{user?.email}</Typography>}
        />
        <SettingRow
          label="Role"
          control={
            <Chip size="small" label={user?.role === 'admin' ? 'Administrator' : 'Member'} />
          }
        />
        <SettingRow
          label="Plan"
          control={
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={subscription.data?.plan_name || 'Loading plan…'}
            />
          }
        />
        <SettingRow
          label="Member since"
          control={
            <Typography variant="body2">
              {user ? new Date(user.created_at * 1000).toLocaleDateString() : ''}
            </Typography>
          }
        />
      </SectionCard>
    </>
  );
}

function AppearanceSection() {
  const [error, setError] = useState('');
  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <SectionCard
        title="Theme"
        description="Changes apply immediately and are saved to your account. New visitors start with the system theme."
      >
        <AppearanceControls onError={setError} />
      </SectionCard>
    </>
  );
}

function PlanSection() {
  const usage = useQuery({ queryKey: ['usage'], queryFn: () => api<Usage>('/usage') });
  const requestShare = usage.data
    ? Math.min(100, Math.round((usage.data.requests / Math.max(1, usage.data.request_limit)) * 100))
    : 0;
  const tokenShare = usage.data
    ? Math.min(
        100,
        Math.round((usage.data.reserved_tokens / Math.max(1, usage.data.token_limit)) * 100),
      )
    : 0;
  return (
    <>
      <SectionCard
        title="Plan and billing"
        description="Assigned by an administrator. Payment collection and invoices are not enabled."
      >
        <SubscriptionPanel />
      </SectionCard>
      <SectionCard
        title="Daily allowance"
        description="Resets at midnight UTC. Tokens are reserved conservatively before generation, including failed and stopped attempts."
      >
        {usage.isPending && <LinearProgress aria-label="Loading usage" />}
        {usage.isError && <Alert severity="error">{usage.error.message}</Alert>}
        {usage.data && (
          <Stack spacing={2}>
            <SettingRow
              label="Chat requests"
              description={`${usage.data.requests} of ${usage.data.request_limit} used today`}
              control={
                <Box sx={{ width: { xs: '100%', sm: 220 } }}>
                  <LinearProgress variant="determinate" value={requestShare} />
                </Box>
              }
            />
            <SettingRow
              label="Reserved tokens"
              description={`${usage.data.reserved_tokens.toLocaleString()} of ${usage.data.token_limit.toLocaleString()} used today`}
              control={
                <Box sx={{ width: { xs: '100%', sm: 220 } }}>
                  <LinearProgress variant="determinate" value={tokenShare} />
                </Box>
              }
            />
          </Stack>
        )}
      </SectionCard>
      <SectionCard title="Recent AI usage">
        <UsageEventsPanel />
      </SectionCard>
    </>
  );
}

function DataSection() {
  const queries = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const images = useQuery({
    queryKey: ['images'],
    queryFn: () => api<StoredImage[]>('/files'),
  });
  async function removeImage(id: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/files/${id}`, 'DELETE');
      await queries.invalidateQueries({ queryKey: ['images'] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <SectionCard
        title="Stored images"
        description="Images you attached in chat. Deleting one removes it from messages that reference it."
      >
        {images.isPending && <LinearProgress aria-label="Loading images" />}
        {images.isError && <Alert severity="error">{images.error.message}</Alert>}
        {images.data?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No images stored yet.
          </Typography>
        )}
        <Stack spacing={1}>
          {images.data?.map((image) => (
            <Stack key={image.id} direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {image.name} · {Math.ceil(image.size / 1024)} KB
              </Typography>
              <Button
                size="small"
                color="error"
                disabled={busy}
                startIcon={<DeleteOutlined />}
                onClick={() => void removeImage(image.id)}
              >
                Delete
              </Button>
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </>
  );
}

function SecuritySection({ signOut, busy }: { signOut: (all: boolean) => void; busy: boolean }) {
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<SessionView[]>('/auth/sessions'),
  });
  return (
    <>
      <SectionCard
        title="Active sessions"
        description="Devices currently signed in to your account."
      >
        {sessions.isPending && <LinearProgress aria-label="Loading sessions" />}
        {sessions.isError && <Alert severity="error">{sessions.error.message}</Alert>}
        {sessions.data && (
          <Stack spacing={1.5}>
            {sessions.data.map((session, index) => (
              <Stack key={index} direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={600}>
                      {session.source.charAt(0).toUpperCase() + session.source.slice(1)}
                    </Typography>
                    {session.current && <Chip size="small" color="primary" label="This device" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Last active {new Date(session.last_active_at * 1000).toLocaleString()} · expires{' '}
                    {new Date(session.expires_at * 1000).toLocaleDateString()}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button disabled={busy} onClick={() => signOut(false)}>
            Sign out
          </Button>
          <Button color="error" disabled={busy} onClick={() => signOut(true)}>
            Sign out all devices
          </Button>
        </Stack>
      </SectionCard>
      <SectionCard
        title="Change password"
        description="Changing your password signs out all devices."
      >
        <PasswordSettings />
      </SectionCard>
    </>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const queries = useQueryClient();
  const [section, setSection] = useState<SectionId>('general');
  const [signingOut, setSigningOut] = useState(false);
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<Subscription>('/subscription'),
    enabled: open,
  });
  const nav: NavItem[] = [
    {
      id: 'general',
      label: 'General',
      hint: 'Your profile and account details.',
      icon: <TuneOutlined fontSize="small" />,
    },
    {
      id: 'appearance',
      label: 'Appearance',
      hint: 'Theme and contrast preferences.',
      icon: <PaletteOutlined fontSize="small" />,
    },
    {
      id: 'plan',
      label: 'Plan & usage',
      hint: 'Your plan, allowances, and recent activity.',
      icon: <WorkspacePremiumOutlined fontSize="small" />,
    },
    {
      id: 'data',
      label: 'Data controls',
      hint: 'Manage the content you have stored.',
      icon: <StorageOutlined fontSize="small" />,
    },
    {
      id: 'security',
      label: 'Sign-in & security',
      hint: 'Sessions, devices, and password.',
      icon: <LockOutlined fontSize="small" />,
    },
  ];
  const active = nav.find((item) => item.id === section) ?? nav[0];
  const initials = (user?.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  async function signOut(all: boolean) {
    setSigningOut(true);
    try {
      await logout(all);
      onClose();
      queries.clear();
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      slotProps={{
        paper: {
          sx: {
            height: { xs: '100dvh', sm: 'min(760px, 92dvh)' },
            borderRadius: { xs: 0, sm: 4 },
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', height: '100%' }}>
        <Box
          component="nav"
          aria-label="Settings sections"
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 2,
            width: 256,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            p: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" px={0.5}>
            <Avatar
              sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontSize: 14, fontWeight: 700 }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {user?.email}
              </Typography>
            </Box>
          </Stack>
          {subscription.data && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${subscription.data.plan_name} plan`}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
          <List disablePadding sx={{ display: 'grid', gap: 0.5, flex: 1, alignContent: 'start' }}>
            {nav.map((item) => (
              <ListItemButton
                key={item.id}
                selected={section === item.id}
                onClick={() => setSection(item.id)}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      fontSize: 14,
                      fontWeight: section === item.id ? 700 : 500,
                      noWrap: true,
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          <Button
            color="inherit"
            startIcon={<LogoutOutlined />}
            disabled={signingOut}
            onClick={() => void signOut(false)}
            sx={{ justifyContent: 'flex-start' }}
          >
            Sign out
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              px: { xs: 2, sm: 4 },
              pt: { xs: 2, sm: 3 },
              pb: 2,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>
                {active.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {active.hint}
              </Typography>
            </Box>
            <IconButton aria-label="Close settings" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              gap: 1,
              overflowX: 'auto',
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            {nav.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                clickable
                color={section === item.id ? 'primary' : 'default'}
                onClick={() => setSection(item.id)}
              />
            ))}
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 4 }, py: { xs: 2, sm: 3 } }}>
            <Stack spacing={3} sx={{ maxWidth: 720 }}>
              {section === 'general' && <GeneralSection />}
              {section === 'appearance' && <AppearanceSection />}
              {section === 'plan' && <PlanSection />}
              {section === 'data' && <DataSection />}
              {section === 'security' && (
                <SecuritySection signOut={(all) => void signOut(all)} busy={signingOut} />
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
