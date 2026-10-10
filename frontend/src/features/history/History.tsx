import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Search from '@mui/icons-material/Search';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { api } from '../../shared/api';
import type { Conversation, Page } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';

export function History({
  active,
  disabled,
  onSelect,
  onNew,
  onSettings,
  onAction,
}: {
  active: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
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
  const history = useInfiniteQuery({
    queryKey: ['history', search, archived],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<Page<Conversation>>(
        `/conversations?q=${encodeURIComponent(search)}&archived=${archived}&cursor=${encodeURIComponent(pageParam)}`,
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
        label="Search conversations"
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
          {history.data?.pages
            .flatMap((page) => page.items)
            .map((row) => (
              <ListItem
                key={row.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    aria-label={`Actions for ${row.title}`}
                    disabled={disabled}
                    onClick={(event) => setMenu({ element: event.currentTarget, row })}
                  >
                    <MoreHoriz />
                  </IconButton>
                }
              >
                <ListItemButton
                  selected={active === row.id}
                  disabled={disabled}
                  onClick={() => onSelect(row.id)}
                  sx={{ borderRadius: 2, pr: 5 }}
                >
                  <ListItemText primary={row.title} primaryTypographyProps={{ noWrap: true }} />
                </ListItemButton>
              </ListItem>
            ))}
        </List>
        {!history.isPending && !history.data?.pages[0].items.length && (
          <Typography variant="body2" color="text.secondary" px={1}>
            No conversations yet.
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
      <Button
        startIcon={<SettingsOutlined />}
        onClick={onSettings}
        sx={{ justifyContent: 'flex-start' }}
      >
        {user?.name}
      </Button>
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
