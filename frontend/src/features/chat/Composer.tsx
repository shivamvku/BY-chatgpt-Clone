import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import StopRounded from '@mui/icons-material/StopRounded';
import AttachFile from '@mui/icons-material/AttachFile';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import type { FormEvent } from 'react';
import { request } from '../../shared/api';

export function Composer({
  busy,
  canStop,
  enabled,
  models,
  selectedModel,
  onModelChange,
  onSend,
  onStop,
}: {
  busy: boolean;
  canStop: boolean;
  enabled: boolean;
  models: any;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onSend: (content: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [modelMenu, setModelMenu] = useState<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || busy || !enabled || uploading) return;
    const value = text;
    if (await onSend(value)) setText('');
  }

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose an image under 2 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const response = await request('/files', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      const image = await response.json();
      setText((value) => `${value}\n![Attached image](${image.url})\n`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* Model Selection - ChatGPT Style */}
      {models.data?.configured && models.data.models.length > 0 && (
        <Box mb={2} display="flex" justifyContent="center">
          <Button
            variant="outlined"
            size="small"
            endIcon={<KeyboardArrowDown />}
            onClick={(e) => setModelMenu(e.currentTarget)}
            sx={{ 
              borderRadius: 3,
              textTransform: 'none',
              minWidth: 200,
              bgcolor: 'background.paper'
            }}
          >
            {models.data.models.find((m: any) => m.id === selectedModel)?.name || 'Select Model'}
          </Button>
          <Menu
            anchorEl={modelMenu}
            open={!!modelMenu}
            onClose={() => setModelMenu(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{
              sx: { borderRadius: 2, minWidth: 250 }
            }}
          >
            {models.data.models.map((model: any) => (
              <MenuItem
                key={model.id}
                selected={model.id === selectedModel}
                onClick={() => {
                  onModelChange(model.id);
                  setModelMenu(null);
                }}
                sx={{ py: 1.5 }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {model.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {model.provider}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}
      
      <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: 1.5, borderRadius: 4 }}>
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={7}
          placeholder="Ask YounderChat anything…"
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || !enabled}
          inputProps={{ maxLength: 12000, 'aria-label': 'Message' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          sx={{
            '& fieldset': { border: 0 },
            '& .MuiInputBase-root': { 
              p: 0.5,
            },
            '& .MuiInputBase-input': {
              '&:focus': {
                outline: 'none',
              },
            },
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Tooltip title="Attach an image (display-only)">
              <span>
                <IconButton
                  aria-label="Attach image"
                  disabled={busy || uploading || !enabled}
                  onClick={() => fileInput.current?.click()}
                >
                  <AttachFile />
                </IconButton>
              </span>
            </Tooltip>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <Typography component="span" variant="caption" color="text.secondary">
              {uploading ? 'Uploading…' : 'Shift + Enter for a new line'}
            </Typography>
          </Box>
          {busy ? (
            <Button
              variant="contained"
              startIcon={<StopRounded />}
              disabled={!canStop}
              onClick={onStop}
            >
              {canStop ? 'Stop' : 'Sending…'}
            </Button>
          ) : (
            <IconButton
              aria-label="Send message"
              type="submit"
              disabled={!text.trim() || !enabled || uploading}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <ArrowUpward />
            </IconButton>
          )}
        </Stack>
      </Paper>
      <Typography
        textAlign="center"
        variant="caption"
        color="text.secondary"
        display="block"
        mt={1}
      >
        AI can make mistakes. Check important information. Images are stored privately and
        displayed; the model cannot see them.
      </Typography>
    </Box>
  );
}
