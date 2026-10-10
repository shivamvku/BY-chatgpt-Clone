import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import type { Conversation } from '../../../shared/types';

interface ConversationDialogProps {
  open: boolean;
  conversation: Conversation | null;
  action: 'Delete' | 'Rename';
  onClose: () => void;
  onConfirm: (title?: string) => void;
}

export function ConversationDialog({
  open,
  conversation,
  action,
  onClose,
  onConfirm,
}: ConversationDialogProps) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title);
    }
  }, [conversation]);

  const handleConfirm = () => {
    if (action === 'Rename') {
      onConfirm(title);
    } else {
      onConfirm();
    }
  };

  const isRename = action === 'Rename';
  const canConfirm = !isRename || title.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>{isRename ? 'Rename conversation' : 'Delete conversation?'}</DialogTitle>
      <DialogContent>
        {isRename ? (
          <TextField
            autoFocus
            label="Conversation title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 120 }}
            sx={{ mt: 1 }}
          />
        ) : (
          <Typography>
            This permanently removes the conversation and all its message branches.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color={isRename ? 'primary' : 'error'}
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {isRename ? 'Save' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
