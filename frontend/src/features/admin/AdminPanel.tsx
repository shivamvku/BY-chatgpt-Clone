import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import { api } from '../../shared/api';
import type { AdminSummary, AdminUser, User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { PlanPanel } from './PlanPanel';
import { AdminUsersTable } from './AdminUsersTable';

type Change = { row: AdminUser; kind: 'role' | 'access' } | null;

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 140, flex: '1 1 140px' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={750}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Box color="primary.main">{icon}</Box>
      </Stack>
    </Paper>
  );
}

export function AdminPanel() {
  const { user } = useAuth();
  const queries = useQueryClient();
  const [change, setChange] = useState<Change>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function update(row: AdminUser, values: Partial<User>) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${row.id}`, 'PATCH', {
        role: row.role,
        active: row.active,
        ...values,
      });
      await Promise.all(
        ['admin-users', 'admin-summary', 'audit'].map((key) =>
          queries.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setChange(null);
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
      await Promise.all(
        ['admin-users', 'subscription', 'audit'].map((key) =>
          queries.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const description =
    change?.kind === 'role'
      ? `${change.row.role === 'admin' ? 'Remove administrator access from' : 'Give administrator access to'} ${change.row.name}? Their active sessions will be revoked.`
      : `${change?.row.active ? 'Disable' : 'Enable'} ${change?.row.name}'s account? ${change?.row.active ? 'Their active sessions will be revoked.' : ''}`;
  return (
    <Stack gap={3}>
      <Box>
        <Typography variant="h6" fontWeight={750}>
          Access management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review people, assign plans, and control account access. Changes are audited and revoke
          affected sessions.
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <SummaryCard
          label="People"
          value={summary.data?.total_users ?? 0}
          icon={<GroupOutlined />}
        />
        <SummaryCard
          label="Active"
          value={summary.data?.active_users ?? 0}
          icon={<PersonAddAltOutlined />}
        />
        <SummaryCard
          label="Verified"
          value={summary.data?.verified_users ?? 0}
          icon={<VerifiedUserOutlined />}
        />
        <SummaryCard
          label="Administrators"
          value={summary.data?.administrators ?? 0}
          icon={<AdminPanelSettingsOutlined />}
        />
      </Stack>
      <AdminUsersTable
        currentUserId={user?.id}
        busy={busy}
        onChange={(row, kind) => setChange({ row, kind })}
        onAssign={(id, plan) => void assign(id, plan)}
      />
      <PlanPanel />
      <Dialog open={!!change} onClose={() => !busy && setChange(null)}>
        <DialogTitle>Confirm access change</DialogTitle>
        <DialogContent>
          <Typography>{description}</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setChange(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={change?.kind === 'access' && change.row.active ? 'error' : 'primary'}
            disabled={!change || busy}
            onClick={() =>
              change &&
              void update(
                change.row,
                change.kind === 'role'
                  ? { role: change.row.role === 'admin' ? 'user' : 'admin' }
                  : { active: !change.row.active },
              )
            }
          >
            {busy ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
