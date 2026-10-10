import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Container, Stack } from '@mui/material';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// Components
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { ConversationDialog } from './components/ConversationDialog';
import { History } from '../history/History';
import { SettingsDialog } from '../settings/SettingsDialog';
import { AdminPage } from '../admin/AdminPage';
import { Composer } from './Composer';
import { SkipLink } from './components/SkipLink';

// Hooks
import { useChat } from './useChat';
import { useAuth } from '../auth/AuthProvider';

// Utils
import { api, request } from '../../shared/api';
import type { Conversation, ModelInfo } from '../../shared/types';

export default function ChatWorkspace() {
  // State
  const [active, setActive] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [settings, setSettings] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [actionError, setActionError] = useState('');
  const [dialog, setDialog] = useState<{
    conversation: Conversation;
    action: 'Delete' | 'Rename';
  } | null>(null);

  // Hooks
  const queries = useQueryClient();
  const { user } = useAuth();

  // Data fetching
  const models = useQuery({
    queryKey: ['models'],
    queryFn: () => api<ModelInfo>('/models'),
  });

  const chat = useChat(active, setActive, selectedModel);

  // Set default model
  useEffect(() => {
    if (models.data?.models.length && !selectedModel) {
      setSelectedModel(models.data.models[0].id);
    }
  }, [models.data, selectedModel]);

  // Chat actions
  const newChat = useCallback(() => {
    setActive(null);
    chat.setLeaf(null);
    chat.setError('');
  }, [chat]);

  const selectConversation = useCallback(
    (id: string) => {
      setActive(id);
      chat.setLeaf(null);
    },
    [chat],
  );

  // History actions
  const handleHistoryAction = useCallback(
    async (row: Conversation, action: string) => {
      setActionError('');

      if (action === 'Delete' || action === 'Rename') {
        setDialog({ conversation: row, action });
        return;
      }

      try {
        if (action.startsWith('Export')) {
          const format = action.endsWith('JSON') ? 'json' : 'markdown';
          const response = await request(`/conversations/${row.id}/export?format=${format}`);
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a');
          link.href = url;
          link.download = `conversation.${format === 'json' ? 'json' : 'md'}`;
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
    },
    [active, newChat, queries],
  );

  // Dialog actions
  const handleDialogConfirm = useCallback(
    async (title?: string) => {
      if (!dialog) return;

      try {
        if (dialog.action === 'Delete') {
          await api(`/conversations/${dialog.conversation.id}`, 'DELETE');
          if (active === dialog.conversation.id) newChat();
        } else if (dialog.action === 'Rename' && title) {
          await api(`/conversations/${dialog.conversation.id}`, 'PATCH', { title });
        }
        await queries.invalidateQueries({ queryKey: ['history'] });
        setDialog(null);
      } catch (failure) {
        setActionError((failure as Error).message);
      }
    },
    [dialog, active, newChat, queries],
  );

  // Show admin page if admin is true
  if (admin && user?.role === 'admin') {
    return <AdminPage onBack={() => setAdmin(false)} />;
  }

  return (
    <Box height="100dvh">
      <SkipLink />

      <PanelGroup direction="horizontal">
        {/* Sidebar */}
        <Panel defaultSize={20} minSize={15} maxSize={35}>
          <Box height="100dvh" bgcolor="background.paper">
            <History
              active={active}
              disabled={chat.busy}
              onSelect={selectConversation}
              onNew={newChat}
              onSettings={() => setSettings(true)}
              onAdmin={() => setAdmin(true)}
              onAction={handleHistoryAction}
            />
          </Box>
        </Panel>

        <PanelResizeHandle
          style={{
            width: 2,
            backgroundColor: 'var(--mui-palette-divider)',
          }}
        />

        {/* Main Chat */}
        <Panel defaultSize={80}>
          <Stack height="100dvh" bgcolor="background.default">
            <ChatHeader />

            <ChatMessages
              chat={chat}
              models={models}
              selectedModel={selectedModel}
              active={active}
              actionError={actionError}
              setActionError={setActionError}
            />

            <Container maxWidth="md" id="composer" sx={{ pb: 2, pt: 1 }}>
              <Composer
                busy={chat.busy}
                canStop={chat.generating}
                enabled={!!models.data?.configured}
                models={models.data}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onStop={() => void chat.stop()}
                onSend={(content) => chat.send(content, null)}
              />
            </Container>
          </Stack>
        </Panel>
      </PanelGroup>

      {/* Dialogs */}
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />

      <ConversationDialog
        open={!!dialog}
        conversation={dialog?.conversation || null}
        action={dialog?.action || 'Delete'}
        onClose={() => setDialog(null)}
        onConfirm={handleDialogConfirm}
      />
    </Box>
  );
}
