import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import { api } from '../../shared/api';
import type { AdminUser, User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { PlanPanel } from './PlanPanel';

interface AdminSummary {
  total_users: number;
  active_users: number;
  verified_users: number;
  administrators: number;
}
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
  const [after, setAfter] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [change, setChange] = useState<Change>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const params = useMemo(() => {
    const value = new URLSearchParams({ after });
    if (deferredQuery.trim()) value.set('query', deferredQuery.trim());
    if (role) value.set('role', role);
    if (active) value.set('active', active);
    return value.toString();
  }, [after, deferredQuery, role, active]);
  const users = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => api<AdminUser[]>(`/admin/users?${params}`),
  });
  const summary = useQuery({
    queryKey: ['admin-summary'],
    queryFn: () => api<AdminSummary>('/admin/summary'),
  });
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
  function resetFilters() {
    setQuery('');
    setRole('');
    setActive('');
    setAfter('');
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
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={1.25}
          p={2}
          borderBottom={1}
          borderColor="divider"
        >
          <TextField
            label="Find a person"
            placeholder="Name or email"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setAfter('');
            }}
            size="small"
            sx={{ flex: 1 }}
          />
          <Select
            value={role}
            displayEmpty
            size="small"
            onChange={(event) => {
              setRole(event.target.value);
              setAfter('');
            }}
            inputProps={{ 'aria-label': 'Filter by role' }}
          >
            <MenuItem value="">All roles</MenuItem>
            <MenuItem value="user">Members</MenuItem>
            <MenuItem value="admin">Administrators</MenuItem>
          </Select>
          <Select
            value={active}
            displayEmpty
            size="small"
            onChange={(event) => {
              setActive(event.target.value);
              setAfter('');
            }}
            inputProps={{ 'aria-label': 'Filter by account status' }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Disabled</MenuItem>
          </Select>
          <Button onClick={resetFilters} disabled={!query && !role && !active}>
            Clear
          </Button>
        </Stack>
        {users.isFetching && <LinearProgress aria-label="Loading users" />}
        {users.isError && (
          <Alert severity="error" sx={{ m: 2 }}>
            Could not load people.
          </Alert>
        )}
        <TableContainer>
          <Table size="small" aria-label="People and access">
            <TableHead>
              <TableRow>
                <TableCell>Person</TableCell>
                <TableCell>Access</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.data?.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={650}>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={row.role === 'admin' ? 'primary' : 'default'}
                      label={row.role === 'admin' ? 'Administrator' : 'Member'}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                      <Chip
                        size="small"
                        color={row.active ? 'success' : 'default'}
                        label={row.active ? 'Active' : 'Disabled'}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={row.verified_user ? 'Verified' : 'Unverified'}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5} alignItems="flex-start">
                      <Select
                        value={row.plan || ''}
                        displayEmpty
                        size="small"
                        sx={{ minWidth: 130 }}
                        disabled={busy || !row.subscription_owner}
                        onChange={(event) => void assign(row.id, event.target.value)}
                        inputProps={{ 'aria-label': `Assign plan for ${row.name}` }}
                      >
                        <MenuItem value="" disabled>
                          No plan assigned
                        </MenuItem>
                        <MenuItem value="basic">Basic</MenuItem>
                        <MenuItem value="pro">Pro</MenuItem>
                        <MenuItem value="pro_max">Pro Max</MenuItem>
                      </Select>
                      {row.plan_name && (
                        <Typography variant="caption" color="text.secondary">
                          {row.plan_name} · {row.subscription_status}
                        </Typography>
                      )}
                      {!row.subscription_owner && row.plan && (
                        <Typography variant="caption" color="text.secondary">
                          Managed by plan owner
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={0.5} flexWrap="wrap">
                      <Button
                        size="small"
                        disabled={busy || row.id === user?.id}
                        onClick={() => setChange({ row, kind: 'role' })}
                      >
                        {row.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Button>
                      <Button
                        size="small"
                        color={row.active ? 'error' : 'primary'}
                        disabled={busy || row.id === user?.id}
                        onClick={() => setChange({ row, kind: 'access' })}
                      >
                        {row.active ? 'Disable' : 'Enable'}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {users.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No people match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" justifyContent="space-between" p={1.5}>
          <Button disabled={!after || busy} onClick={() => setAfter('')}>
            First page
          </Button>
          <Button
            disabled={busy || !users.data || users.data.length < 30}
            onClick={() => setAfter(users.data?.at(-1)?.id || '')}
          >
            Next page
          </Button>
        </Stack>
      </Paper>
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
