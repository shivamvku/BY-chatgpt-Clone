import { useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { MessageCard } from '../MessageCard';
import { visibleBranch } from '../branches';

interface ChatMessagesProps {
  chat: any;
  models: any;
  selectedModel: string;
  active: string | null;
  actionError: string;
  setActionError: (error: string) => void;
}

export function ChatMessages({ 
  chat, 
  models, 
  selectedModel, 
  active, 
  actionError, 
  setActionError 
}: ChatMessagesProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const visible = visibleBranch(chat.messages.data || [], chat.leaf);

  useEffect(() => {
    if (nearBottom.current) {
      scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
    }
  }, [chat.messages.data]);

  const handleScroll = () => {
    const element = scroll.current;
    if (element) {
      nearBottom.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    }
  };

  const startingPrompts = [
    'Explain a complex idea',
    'Help me make a plan',
    'Explore a new perspective',
  ];

  return (
    <Box ref={scroll} onScroll={handleScroll} flex={1} overflow="auto">
      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* Error Messages */}
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

        {/* Configuration Messages */}
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

        {/* Loading State */}
        {chat.messages.isLoading && <CircularProgress aria-label="Loading conversation" />}

        {/* Messages */}
        {visible.length > 0 ? (
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
        ) : !active ? (
          /* Empty State */
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
            {selectedModel && (
              <Chip
                label={`Using ${models.data?.models.find((m: any) => m.id === selectedModel)?.name}`}
                variant="outlined"
                size="small"
                color="primary"
              />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={2}>
              {startingPrompts.map((prompt) => (
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
        ) : null}
      </Container>
    </Box>
  );
}