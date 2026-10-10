import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Alert,
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
  Typography,
  useMediaQuery,
} from '@mui/material';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { History } from '../history/History';
import { SettingsDialog } from '../settings/SettingsDialog';
import { AdminPage } from '../admin/AdminPage';
import { Composer } from './Composer';
import { MessageCard } from './MessageCard';
import { useChat } from './useChat';
import { visibleBranch } from './branches';
import { api, request } from '../../shared/api';
import { DEFAULT_MODEL, type Conversation, type ModelInfo } from '../../shared/types';

export default function ChatWorkspace() {
  const [active, setActive] = useState<string | null>(null),
    [drawer, setDrawer] = useState(false),
    [settings, setSettings] = useState(false),
    [adminPage, setAdminPage] = useState(false),
    [dialog, setDialog] = useState<{ row: Conversation; action: string } | null>(null),
    [title, setTitle] = useState('');

  const wide = useMediaQuery('(min-width:900px)'),
    queries = useQueryClient();

  const select = (id: string) => {
    setActive(id);
    setDrawer(false);
  };

  const chat = useChat(active, select),
    models = useQuery({ queryKey: ['models'], queryFn: () => api<ModelInfo>('/models') });

  const [model, setModel] = useState(DEFAULT_MODEL);

  const visible = visibleBranch(chat.messages.data || [], chat.leaf),
    scroll = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);

  // Virtualiser for long conversations (> 20 messages)
  const useVirtual = visible.length > 20;
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 140,
    overscan: 4,
    enabled: useVirtual,
  });

  useEffect(() => {
    if (!nearBottom.current) return;
    if (useVirtual && visible.length > 0) {
      virtualizer.scrollToIndex(visible.length - 1, { behavior: 'smooth' });
    } else {
      scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chat.messages.data, useVirtual, virtualizer, visible.length]);

  useEffect(() => {
    if (models.data?.models.some((item) => item.id === model && item.available)) return;
    const fallback = models.data?.models.find((item) => item.available);
    if (fallback) setModel(fallback.id);
  }, [model, models.data]);

  function newChat() {
    setActive(null);
    chat.setLeaf(null);
    chat.setError('');
    setDrawer(false);
  }

  async function historyAction(row: Conversation, action: string) {
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
        await api(`/conversations/${row.id}`, 'PATCH', { archived: action === 'Archive' });
        await queries.invalidateQueries({ queryKey: ['history'] });
        if (active === row.id) newChat();
      }
    } catch (failure) {
      toast.error((failure as Error).message);
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
      toast.error((failure as Error).message);
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
      onAdmin={() => {
        setDrawer(false);
        setAdminPage(true);
      }}
      onAction={(row, action) => void historyAction(row, action)}
    />
  );

  const mainContent = (
    <Stack component="main" flex={1} minWidth={0} height="100%" overflow="hidden">
      {/* Mobile-only header */}
      {!wide && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            minHeight: 48,
            flexShrink: 0,
          }}
        >
          <IconButton aria-label="Open conversations" onClick={() => setDrawer(true)}>
            <MenuOutlined />
          </IconButton>
          <Typography fontWeight={700} sx={{ ml: 1 }}>
            YounderChat
          </Typography>
        </Box>
      )}
      <Box
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        flex={1}
        overflow="auto"
      >
        <Container maxWidth="md" sx={{ py: 4, px: { xs: 2, md: 3 } }}>
          {(chat.error || chat.messages.isError) && (
            <Alert severity="error" onClose={() => chat.setError('')} sx={{ mb: 2 }}>
              {chat.error || 'Could not load messages. Retry by selecting this conversation.'}
            </Alert>
          )}
          {models.data && !models.data.configured && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Chat is currently unavailable. Contact your administrator.
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
            useVirtual ? (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((item) => (
                  <div
                    key={visible[item.index].id}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    style={{ position: 'absolute', top: item.start, width: '100%' }}
                  >
                    <MessageCard
                      message={visible[item.index]}
                      all={chat.messages.data || []}
                      busy={chat.busy}
                      onSelect={chat.setLeaf}
                      onEdit={(row, content) => void chat.send(content, row.parent_id)}
                      onRegenerate={(row) => void chat.regenerate(row)}
                      onStop={(row) => void chat.stopMessage(row)}
                    />
                  </div>
                ))}
              </div>
            ) : (
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
            )
          ) : (
            <Stack minHeight="60vh" justifyContent="center" alignItems="center" gap={2}>
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
                {['Explain a complex idea', 'Help me make a plan', 'Explore a new perspective'].map(
                  (prompt) => (
                    <Button
                      key={prompt}
                      variant="outlined"
                      disabled={chat.busy || !models.data?.configured}
                      onClick={() => void chat.send(prompt, null, model)}
                    >
                      {prompt}
                    </Button>
                  ),
                )}
              </Stack>
            </Stack>
          )}
        </Container>
      </Box>
      <Container maxWidth="md" id="composer" sx={{ pb: 2, pt: 1, flexShrink: 0 }}>
        <Composer
          busy={chat.busy}
          canStop={chat.generating}
          enabled={!!models.data?.configured}
          models={models.data?.models || []}
          model={model}
          onModelChange={setModel}
          onStop={() => void chat.stop()}
          onSend={(content) => chat.send(content, visible.at(-1)?.id || null, model)}
        />
      </Container>
    </Stack>
  );

  return (
    <Box display="flex" height="100dvh" overflow="hidden">
      <Box
        component="a"
        href="#composer"
        sx={{
          position: 'absolute',
          left: -9999,
          '&:focus': { left: 16, top: 16, zIndex: 2000, bgcolor: 'background.paper', p: 2 },
        }}
      >
        Skip to message composer
      </Box>

      {wide ? (
        // Desktop: resizable sidebar + main via PanelGroup
        <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }}>
          <Panel defaultSize={22} minSize={14} maxSize={35}>
            <Box height="100%" overflow="hidden">
              {history}
            </Box>
          </Panel>
          <PanelResizeHandle style={{ width: 4, cursor: 'col-resize', position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.main', opacity: 0.2 },
                transition: 'all 0.15s',
              }}
            />
          </PanelResizeHandle>
          <Panel minSize={50} style={{ display: 'flex', flexDirection: 'column' }}>
            {mainContent}
          </Panel>
        </PanelGroup>
      ) : (
        // Mobile: temporary drawer + full-width main
        <>
          <Drawer
            variant="temporary"
            open={drawer}
            onClose={() => setDrawer(false)}
            sx={{ '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' } }}
          >
            {history}
          </Drawer>
          <Box flex={1} minWidth={0} display="flex" flexDirection="column">
            {mainContent}
          </Box>
        </>
      )}

      {settings && <SettingsDialog open onClose={() => setSettings(false)} />}
      {adminPage && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'background.default' }}>
          <AdminPage onBack={() => setAdminPage(false)} />
        </Box>
      )}

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
