import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
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
import { api } from '../../shared/api';
import type { AdminUser } from '../../shared/types';

interface AdminUsersTableProps {
  currentUserId?: string;
  busy: boolean;
  onChange: (row: AdminUser, kind: 'role' | 'access') => void;
  onAssign: (id: string, plan: string) => void;
}

export function AdminUsersTable({
  currentUserId,
  busy,
  onChange,
  onAssign,
}: AdminUsersTableProps) {
  const [after, setAfter] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
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

  function resetFilters() {
    setQuery('');
    setRole('');
    setActive('');
    setAfter('');
  }

  return (
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
                      onChange={(event) => onAssign(row.id, event.target.value)}
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
                      disabled={busy || row.id === currentUserId}
                      onClick={() => onChange(row, 'role')}
                    >
                      {row.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </Button>
                    <Button
                      size="small"
                      color={row.active ? 'error' : 'primary'}
                      disabled={busy || row.id === currentUserId}
                      onClick={() => onChange(row, 'access')}
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
  );
}
