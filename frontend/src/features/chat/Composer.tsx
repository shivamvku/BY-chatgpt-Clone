import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
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
import Add from '@mui/icons-material/Add';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import Close from '@mui/icons-material/Close';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { request } from '../../shared/api';
import type { ModelInfo } from '../../shared/types';

type UploadedImage = { id: string; name: string; url: string };

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
  models: ModelInfo | undefined;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onSend: (content: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [modelMenu, setModelMenu] = useState<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = models?.models.find((item) => item.id === selectedModel);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if ((!text.trim() && !images.length) || busy || !enabled || uploading || !selected?.available)
      return;
    if (images.length && !selected.supports_images) {
      setError('Select a Gemini model to analyse an image.');
      return;
    }
    const attachments = images.map((image) => `![${image.name}](${image.url})`).join('\n');
    if (await onSend([text.trim(), attachments].filter(Boolean).join('\n\n'))) {
      setText('');
      setImages([]);
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError('Choose an image under 2 MB.');
    setUploading(true);
    setError('');
    try {
      const response = await request('/files', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      const image = (await response.json()) as UploadedImage;
      setImages((value) => [...value, image]);
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
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Paper
        component="form"
        onSubmit={submit}
        elevation={2}
        sx={{ p: 1.25, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}
      >
        {images.length > 0 && (
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ px: 0.5, pb: 0.75 }}>
            {images.map((image) => (
              <Box
                key={image.id}
                sx={{
                  position: 'relative',
                  width: 76,
                  height: 76,
                  overflow: 'hidden',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.name}
                  sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <IconButton
                  aria-label={`Remove ${image.name}`}
                  size="small"
                  onClick={() => setImages((value) => value.filter((item) => item.id !== image.id))}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'common.white',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={7}
          placeholder="Message YounderChat"
          aria-label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy || !enabled}
          inputProps={{ maxLength: 12000, 'aria-label': 'Message' }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          sx={{
            '& fieldset': { border: 0 },
            '& .MuiInputBase-root': { p: 0.5 },
            '& .MuiInputBase-input:focus-visible': { outline: 'none' },
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mt={0.5}>
          <Stack direction="row" alignItems="center" gap={0.25}>
            <Tooltip title="Add image">
              <span>
                <IconButton
                  aria-label="Add image"
                  size="small"
                  disabled={busy || uploading || !enabled}
                  onClick={() => fileInput.current?.click()}
                >
                  <Add />
                </IconButton>
              </span>
            </Tooltip>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void upload(event.target.files?.[0])}
            />
            <Typography variant="caption" color="text.secondary">
              {uploading ? 'Uploading…' : 'Shift + Enter for a new line'}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Button
              size="small"
              disabled={busy || !models?.models.length}
              endIcon={<KeyboardArrowDown />}
              onClick={(event) => setModelMenu(event.currentTarget)}
              aria-label={`Model: ${selected?.name ?? 'Select model'}`}
              aria-haspopup="listbox"
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 5,
                color: 'text.secondary',
                fontSize: '0.8rem',
                px: 1.25,
                textTransform: 'none',
              }}
            >
              {selected?.name ?? 'Select model'}
            </Button>
            <Menu
              anchorEl={modelMenu}
              open={!!modelMenu}
              onClose={() => setModelMenu(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              slotProps={{ paper: { sx: { maxHeight: 176, minWidth: 230 } } }}
            >
              {models?.models.map((item) => (
                <MenuItem
                  key={item.id}
                  selected={item.id === selectedModel}
                  disabled={!item.available}
                  onClick={() => {
                    onModelChange(item.id);
                    setModelMenu(null);
                  }}
                >
                  <Stack>
                    <Typography variant="body2">{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.provider}
                      {item.supports_images ? ' · vision' : ''}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Menu>
            {busy ? (
              <IconButton aria-label="Stop" color="primary" onClick={onStop} disabled={!canStop}>
                <Close />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Send message"
                type="submit"
                size="small"
                disabled={
                  (!text.trim() && !images.length) || !enabled || uploading || !selected?.available
                }
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                <ArrowUpward />
              </IconButton>
            )}
          </Stack>
        </Stack>
      </Paper>
      <Typography
        textAlign="center"
        variant="caption"
        color="text.disabled"
        display="block"
        mt={0.5}
      >
        AI can make mistakes. Check important information.
      </Typography>
    </Box>
  );
}
