import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ReplayOutlined from '@mui/icons-material/ReplayOutlined';
import StopRounded from '@mui/icons-material/StopRounded';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { motion, useReducedMotion } from 'framer-motion';
import type { Message } from '../../shared/types';
import { RichContent } from './RichContent';
import { ThinkingIndicator } from './ThinkingIndicator';
import { siblings } from './branches';

export function MessageCard({
  message,
  all,
  busy,
  onEdit,
  onRegenerate,
  onStop,
  onSelect,
}: {
  message: Message;
  all: Message[];
  busy: boolean;
  onEdit: (message: Message, content: string) => void;
  onRegenerate: (message: Message) => void;
  onStop: (message: Message) => void;
  onSelect: (id: string) => void;
}) {
  const [edit, setEdit] = useState(false),
    [content, setContent] = useState(message.content),
    [copied, setCopied] = useState(false);
  const variants = siblings(all, message),
    index = variants.findIndex((row) => row.id === message.id);
  const active = ['pending', 'streaming', 'stopping'].includes(message.status);
  const reduced = useReducedMotion();

  // Show thinking indicator when streaming but no content yet
  const isThinking = message.status === 'streaming' && !message.content;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <Box component="article" data-msg="true" sx={{ py: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={message.role === 'user' ? 'flex-end' : 'flex-start'}
          gap={1}
          mb={0.5}
        >
          <Typography
            variant="overline"
            fontWeight={700}
            fontSize="0.65rem"
            color={message.role === 'assistant' ? 'primary' : 'text.disabled'}
          >
            {message.role === 'assistant' ? 'YounderChat' : 'You'}
          </Typography>
          {message.status !== 'complete' && message.status !== 'streaming' && (
            <Chip
              size="small"
              label={message.status}
              color={message.status === 'failed' ? 'error' : 'default'}
            />
          )}
        </Stack>
        <Box sx={message.role === 'user' ? { display: 'flex', justifyContent: 'flex-end' } : {}}>
          <Box
            sx={
              message.role === 'user'
                ? { bgcolor: 'action.hover', px: 2.5, py: 1.5, borderRadius: 4, maxWidth: '70%' }
                : { maxWidth: '100%' }
            }
          >
            {isThinking ? (
              <ThinkingIndicator />
            ) : (
              <RichContent content={message.content} streaming={message.status === 'streaming'} />
            )}
          </Box>
        </Box>
        <Box
          sx={{
            opacity: active || message.status === 'failed' ? 1 : 0,
            transition: 'opacity 0.15s',
            '[data-msg="true"]:hover &, &:focus-within': { opacity: 1 },
          }}
        >
          <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
            <Tooltip title={copied ? 'Copied' : 'Copy message'}>
              <IconButton
                aria-label="Copy message"
                size="small"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(message.content)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() => setCopied(false))
                }
              >
                <ContentCopyOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            {message.role === 'user' ? (
              <Tooltip title="Edit prompt">
                <span>
                  <IconButton
                    aria-label="Edit prompt"
                    disabled={busy}
                    size="small"
                    onClick={() => {
                      setContent(message.content);
                      setEdit(true);
                    }}
                  >
                    <EditOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title={active ? 'Stop response' : 'Regenerate response'}>
                <span>
                  <IconButton
                    aria-label={active ? 'Stop response' : 'Regenerate response'}
                    size="small"
                    disabled={busy || message.status === 'stopping'}
                    onClick={() => (active ? onStop(message) : onRegenerate(message))}
                  >
                    {active ? (
                      <StopRounded fontSize="small" />
                    ) : (
                      <ReplayOutlined fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {variants.length > 1 && (
              <>
                <IconButton
                  aria-label="Previous version"
                  size="small"
                  disabled={busy || index === 0}
                  onClick={() => onSelect(variants[index - 1].id)}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="caption">
                  {index + 1}/{variants.length}
                </Typography>
                <IconButton
                  aria-label="Next version"
                  size="small"
                  disabled={busy || index === variants.length - 1}
                  onClick={() => onSelect(variants[index + 1].id)}
                >
                  <ChevronRight />
                </IconButton>
              </>
            )}
          </Stack>
        </Box>
        <Dialog open={edit} onClose={() => setEdit(false)} fullWidth>
          <DialogTitle>Edit prompt</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              label="Prompt"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              sx={{ mt: 1 }}
              inputProps={{ maxLength: 12000 }}
            />
            <Typography variant="caption">
              This creates a new branch and preserves your previous conversation.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEdit(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!content.trim()}
              onClick={() => {
                onEdit(message, content);
                setEdit(false);
              }}
            >
              Send edited prompt
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </motion.div>
  );
}
