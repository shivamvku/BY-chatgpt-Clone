import { useDeferredValue, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Search from '@mui/icons-material/Search';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import { api } from '../../shared/api';
import type { Conversation, Page, Usage } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';

export function History({
  active,
  disabled,
  onSelect,
  onNew,
  onSettings,
  onAdmin,
  onAction,
}: {
  active: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  onAdmin: () => void;
  onAction: (row: Conversation, action: string) => void;
}) {
  const { user } = useAuth(),
    queries = useQueryClient();
  const [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [menu, setMenu] = useState<{
      element: HTMLElement;
      row: Conversation;
    } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const usage = useQuery({
    queryKey: ['usage'],
    queryFn: () => api<Usage>('/usage'),
    refetchInterval: 60000,
  });
  const requestPct = usage.data
    ? Math.min(100, Math.round((usage.data.requests / Math.max(1, usage.data.request_limit)) * 100))
    : 0;
  const tokenPct = usage.data
    ? Math.min(
        100,
        Math.round((usage.data.reserved_tokens / Math.max(1, usage.data.token_limit)) * 100),
      )
    : 0;
  const history = useInfiniteQuery({
    queryKey: ['history', deferredSearch, archived],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<Page<Conversation>>(
        `/conversations?q=${encodeURIComponent(deferredSearch)}&archived=${archived}&cursor=${encodeURIComponent(pageParam)}`,
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });
  return (
    <Stack height="100%" p={2} gap={2} bgcolor="background.paper">
      <Typography variant="h6" fontWeight={800} color="primary" px={1} py={1}>
        YounderChat
      </Typography>
      <Button variant="contained" startIcon={<Add />} disabled={disabled} onClick={onNew}>
        New conversation
      </Button>
      <TextField
        size="small"
        placeholder="Search conversations"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <Button size="small" onClick={() => setArchived((value) => !value)}>
        {archived ? 'Show active conversations' : 'Show archived conversations'}
      </Button>
      <Box flex={1} overflow="auto">
        <Typography variant="overline" color="text.secondary" px={1}>
          {archived ? 'Archived' : 'Your conversations'}
        </Typography>
        {history.isError && (
          <Alert
            severity="error"
            action={<Button onClick={() => void history.refetch()}>Retry</Button>}
          >
            Could not load history
          </Alert>
        )}
        <List dense>
          {history.isPending && (
            <Stack gap={1} px={1}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="text" height={40} />
              ))}
            </Stack>
          )}
          {history.data?.pages
            .flatMap((page) => page.items)
            .map((row) => (
              <ListItem
                key={row.id}
                disablePadding
                secondaryAction={
                  <span className="action-btn">
                    <IconButton
                      aria-label={`Actions for ${row.title}`}
                      disabled={disabled}
                      onClick={(event) => setMenu({ element: event.currentTarget, row })}
                    >
                      <MoreHoriz />
                    </IconButton>
                  </span>
                }
                sx={{
                  '& .action-btn': { opacity: 0, transition: 'opacity 0.15s' },
                  '&:hover .action-btn, &:focus-within .action-btn': { opacity: 1 },
                }}
              >
                <ListItemButton
                  selected={active === row.id}
                  disabled={disabled}
                  onClick={() => onSelect(row.id)}
                  sx={{
                    borderRadius: 2,
                    pr: 5,
                    '&.Mui-selected': {
                      borderLeft: '3px solid',
                      borderColor: 'primary.main',
                      pl: 1.625,
                    },
                  }}
                >
                  <ListItemText primary={row.title} primaryTypographyProps={{ noWrap: true }} />
                </ListItemButton>
              </ListItem>
            ))}
        </List>
        {!history.isPending && !history.data?.pages[0].items.length && (
          <Typography variant="body2" color="text.secondary" px={1}>
            {search ? 'No conversations match your search.' : 'No conversations yet.'}
          </Typography>
        )}
        {history.hasNextPage && (
          <Button
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            Load more
          </Button>
        )}
      </Box>
      <Divider />
      {usage.data && (
        <Tooltip
          title={`${usage.data.requests} / ${usage.data.request_limit} requests · ${Math.round(usage.data.reserved_tokens / 1000)}k / ${Math.round(usage.data.token_limit / 1000)}k tokens today`}
          placement="top"
        >
          <Box sx={{ px: 1, pb: 0.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.25}>
              <Typography variant="caption" color="text.secondary">
                Daily usage
              </Typography>
              <Typography
                variant="caption"
                color={
                  requestPct >= 90 ? 'error' : tokenPct >= 90 ? 'warning.main' : 'text.secondary'
                }
                fontWeight={600}
              >
                {Math.max(requestPct, tokenPct)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.max(requestPct, tokenPct)}
              color={Math.max(requestPct, tokenPct) >= 90 ? 'error' : 'primary'}
              sx={{ height: 3, borderRadius: 2 }}
            />
          </Box>
        </Tooltip>
      )}
      <Button
        startIcon={<SettingsOutlined />}
        onClick={onSettings}
        sx={{ justifyContent: 'flex-start' }}
      >
        {user?.name}
      </Button>
      {user?.role === 'admin' && (
        <Button
          startIcon={<AdminPanelSettingsOutlined />}
          onClick={onAdmin}
          sx={{ justifyContent: 'flex-start' }}
        >
          Admin
        </Button>
      )}
      <Menu open={!!menu} anchorEl={menu?.element} onClose={() => setMenu(null)}>
        {[
          'Rename',
          menu?.row.archived ? 'Unarchive' : 'Archive',
          'Export Markdown',
          'Export JSON',
          'Delete',
        ].map((action) => (
          <MenuItem
            key={action}
            onClick={() => {
              if (menu) onAction(menu.row, action);
              setMenu(null);
              if (action === 'Archive' || action === 'Unarchive')
                void queries.invalidateQueries({ queryKey: ['history'] });
            }}
          >
            {action}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
