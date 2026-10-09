import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import Add from '@mui/icons-material/Add';
import { History } from '../history/History';
import { SettingsDialog } from '../settings/SettingsDialog';
import { Composer } from './Composer';
import { MessageCard } from './MessageCard';
import { useChat } from './useChat';
import { visibleBranch } from './branches';
import { api, request } from '../../shared/api';
import type { Conversation, ModelInfo } from '../../shared/types';

export default function ChatWorkspace() {
  const [active, setActive] = useState<string | null>(null),
    [drawer, setDrawer] = useState(false),
    [settings, setSettings] = useState(false),
    [dialog, setDialog] = useState<{
      row: Conversation;
      action: string;
    } | null>(null),
    [title, setTitle] = useState(''),
    [actionError, setActionError] = useState('');
  const wide = useMediaQuery('(min-width:900px)'),
    queries = useQueryClient();
  const select = (id: string) => {
    setActive(id);
    setDrawer(false);
  };
  const chat = useChat(active, select),
    models = useQuery({
      queryKey: ['models'],
      queryFn: () => api<ModelInfo>('/models'),
    });
  const visible = visibleBranch(chat.messages.data || [], chat.leaf),
    scroll = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  useEffect(() => {
    if (nearBottom.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [chat.messages.data]);
  function newChat() {
    setActive(null);
    chat.setLeaf(null);
    chat.setError('');
    setDrawer(false);
  }
  async function historyAction(row: Conversation, action: string) {
    setActionError('');
    if (action === 'Delete' || action === 'Rename') {
      setDialog({ row, action });
      setTitle(row.title);
      return;
    }
    try {
      if (action.startsWith('Export')) {
        const response = await request(
          `/conversations/${row.id}/export?format=${action.endsWith('JSON') ? 'json' : 'markdown'}`,
        );
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation.${action.endsWith('JSON') ? 'json' : 'md'}`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await api(`/conversations/${row.id}`, 'PATCH', {
          archived: action === 'Archive',
        });
        await queries.invalidateQueries({ queryKey: ['history'] });
        if (active === row.id) newChat();
      }
    } catch (failure) {
      setActionError((failure as Error).message);
    }
  }
  async function confirmAction() {
    if (!dialog) return;
    try {
      await api(
        `/conversations/${dialog.row.id}`,
        dialog.action === 'Delete' ? 'DELETE' : 'PATCH',
        dialog.action === 'Delete' ? undefined : { title },
      );
      if (dialog.action === 'Delete' && active === dialog.row.id) newChat();
      await queries.invalidateQueries({ queryKey: ['history'] });
      setDialog(null);
    } catch (failure) {
      setActionError((failure as Error).message);
    }
  }
  const history = (
    <History
      active={active}
      disabled={chat.busy}
      onNew={newChat}
      onSelect={(id) => {
        select(id);
        chat.setLeaf(null);
        nearBottom.current = true;
      }}
      onSettings={() => {
        setDrawer(false);
        setSettings(true);
      }}
      onAction={(row, action) => void historyAction(row, action)}
    />
  );
  return (
    <Box display="flex" height="100dvh" overflow="hidden">
      <Box
        component="a"
        href="#composer"
        sx={{
          position: 'absolute',
          left: -9999,
          '&:focus': {
            left: 16,
            top: 16,
            zIndex: 2000,
            bgcolor: 'background.paper',
            p: 2,
          },
        }}
      >
        Skip to message composer
      </Box>
      <Drawer
        variant={wide ? 'permanent' : 'temporary'}
        open={wide || drawer}
        onClose={() => setDrawer(false)}
        sx={{
          width: wide ? 280 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' },
        }}
      >
        {history}
      </Drawer>
      <Stack component="main" flex={1} minWidth={0}>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Toolbar>
            {!wide && (
              <IconButton aria-label="Open conversations" onClick={() => setDrawer(true)}>
                <MenuOutlined />
              </IconButton>
            )}
            <Typography fontWeight={700} flex={1}>
              {models.data?.models[0]?.name || 'YounderChat'}
            </Typography>
            <IconButton aria-label="New conversation" disabled={chat.busy} onClick={newChat}>
              <Add />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box
          ref={scroll}
          onScroll={() => {
            const element = scroll.current;
            if (element)
              nearBottom.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 120;
          }}
          flex={1}
          overflow="auto"
        >
          <Container maxWidth="md" sx={{ py: 3 }}>
            {actionError && (
              <Alert severity="error" onClose={() => setActionError('')}>
                {actionError}
              </Alert>
            )}
            {(chat.error || chat.messages.isError) && (
              <Alert severity="error" onClose={() => chat.setError('')}>
                {chat.error || 'Could not load messages. Retry by selecting this conversation.'}
              </Alert>
            )}
            {models.data && !models.data.configured && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Chat is currently unavailable. Your account, settings, and saved conversations are
                still accessible. Please contact your administrator.
              </Alert>
            )}
            {models.isError && (
              <Alert
                severity="error"
                action={<Button onClick={() => void models.refetch()}>Retry</Button>}
              >
                Could not load model configuration.
              </Alert>
            )}
            {chat.messages.isLoading ? (
              <CircularProgress aria-label="Loading conversation" />
            ) : visible.length ? (
              visible.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  all={chat.messages.data || []}
                  busy={chat.busy}
                  onSelect={chat.setLeaf}
                  onEdit={(row, content) => void chat.send(content, row.parent_id)}
                  onRegenerate={(row) => void chat.regenerate(row)}
                  onStop={(row) => void chat.stopMessage(row)}
                />
              ))
            ) : (
              <Stack minHeight="45vh" justifyContent="center" alignItems="center" gap={2}>
                <Typography variant="overline" color="primary" fontWeight={800}>
                  A little curiosity goes a long way
                </Typography>
                <Typography variant="h4" textAlign="center">
                  What will you explore today?
                </Typography>
                <Typography color="text.secondary" textAlign="center">
                  Start with a question. Build on an idea. Make something clearer.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={2}>
                  {[
                    'Explain a complex idea',
                    'Help me make a plan',
                    'Explore a new perspective',
                  ].map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outlined"
                      disabled={chat.busy || !models.data?.configured}
                      onClick={() => void chat.send(prompt, null)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            )}
          </Container>
        </Box>
        <Container maxWidth="md" id="composer" sx={{ pb: 2, pt: 1 }}>
          <Composer
            busy={chat.busy}
            canStop={chat.generating}
            enabled={!!models.data?.configured}
            onStop={() => void chat.stop()}
            onSend={(content) => chat.send(content, visible.at(-1)?.id || null)}
          />
        </Container>
      </Stack>
      {settings && <SettingsDialog open onClose={() => setSettings(false)} />}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} fullWidth>
        <DialogTitle>
          {dialog?.action === 'Delete' ? 'Delete conversation?' : 'Rename conversation'}
        </DialogTitle>
        <DialogContent>
          {dialog?.action === 'Delete' ? (
            <Typography>
              This permanently removes the conversation and all its message branches.
            </Typography>
          ) : (
            <TextField
              autoFocus
              label="Conversation title"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 120 }}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={dialog?.action === 'Delete' ? 'error' : 'primary'}
            disabled={!title.trim()}
            onClick={() => void confirmAction()}
          >
            {dialog?.action === 'Delete' ? 'Delete' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
