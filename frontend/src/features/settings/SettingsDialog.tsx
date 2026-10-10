import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { api } from '../../shared/api';
import type { Subscription, Usage } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import {
  AppearanceSection,
  DataSection,
  GeneralSection,
  PlanSection,
  SecuritySection,
} from './SettingsSections';

type SectionId = 'general' | 'appearance' | 'plan' | 'data' | 'security' | 'admin';

interface NavItem {
  id: SectionId;
  label: string;
  hint: string;
  icon: ReactNode;
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
  const usage = useQuery({
    queryKey: ['usage'],
    queryFn: () => api<Usage>('/usage'),
    enabled: open,
  });
  const requestShare = usage.data
    ? Math.min(100, Math.round((usage.data.requests / Math.max(1, usage.data.request_limit)) * 100))
    : 0;
  const tokenShare = usage.data
    ? Math.min(
        100,
        Math.round((usage.data.reserved_tokens / Math.max(1, usage.data.token_limit)) * 100),
      )
    : 0;
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
          <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Daily usage
            </Typography>
            {usage.isPending && <LinearProgress aria-label="Loading daily usage" />}
            {usage.isError && (
              <Typography variant="caption" color="text.secondary">
                Usage is currently unavailable.
              </Typography>
            )}
            {usage.data && (
              <Stack spacing={1.25}>
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Chat requests
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {usage.data.requests}/{usage.data.request_limit}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    aria-label="Daily chat request usage"
                    variant="determinate"
                    value={requestShare}
                  />
                </Box>
                <Box>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Reserved tokens
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {usage.data.reserved_tokens.toLocaleString()}/
                      {usage.data.token_limit.toLocaleString()}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    aria-label="Daily reserved token usage"
                    variant="determinate"
                    value={tokenShare}
                  />
                </Box>
                <Button
                  size="small"
                  onClick={() => setSection('plan')}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  View plan &amp; usage
                </Button>
              </Stack>
            )}
          </Box>
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
