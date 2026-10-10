import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  ListSubheader,
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicNoneOutlined from '@mui/icons-material/MicNoneOutlined';
import StopRounded from '@mui/icons-material/StopRounded';
import { request } from '../../shared/api';
import type { ModelChoice } from '../../shared/types';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
  onend: () => void;
  onerror: () => void;
};

const MODEL_MENU_HEIGHT = 3 * 48 + 32;

type UploadedImage = { id: string; name: string; url: string };

/** Strip provider prefix for a compact button label. */
function shortName(name: string): string {
  return name
    .replace(/^Gemini\s+/i, '')
    .replace(/^Groq\s+·\s+/i, '')
    .trim();
}

export function Composer({
  busy,
  canStop,
  enabled,
  models,
  model,
  onModelChange,
  onSend,
  onStop,
}: {
  busy: boolean;
  canStop: boolean;
  enabled: boolean;
  models: ModelChoice[];
  model: string;
  onModelChange: (model: string) => void;
  onSend: (content: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState(''),
    [images, setImages] = useState<UploadedImage[]>([]),
    [uploading, setUploading] = useState(false),
    [listening, setListening] = useState(false),
    [error, setError] = useState(''),
    [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    recognition = useRef<SpeechRecognitionLike | null>(null);
  const selected = models.find((item) => item.id === model);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if ((!text.trim() && !images.length) || busy || !enabled || uploading || !selected?.available) return;
    if (images.length && selected.provider !== 'gemini') {
      setError('Image analysis is available with Gemini. Select Gemini Flash to continue.');
      return;
    }
    const attachments = images.map((image) => `![${image.name}](${image.url})`).join('\n');
    const content = [text.trim(), attachments].filter(Boolean).join('\n\n');
    if (await onSend(content)) {
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
      const image = await response.json();
      setImages((value) => [...value, image]);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function dictate() {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;
    if (!Recognition) return setError('Voice input is not supported by this browser.');
    if (listening) return recognition.current?.stop();
    const instance = new Recognition();
    recognition.current = instance;
    instance.lang = navigator.language || 'en-US';
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) =>
      setText((value) => `${value}${value ? ' ' : ''}${event.results[0][0].transcript}`);
    instance.onend = () => setListening(false);
    instance.onerror = () => {
      setListening(false);
      setError('Voice input could not be completed.');
    };
    setListening(true);
    instance.start();
  }

  const geminiModels = models.filter((m) => m.provider === 'gemini');
  const groqModels = models.filter((m) => m.provider === 'groq');

  return (
    <Box>
      {!enabled && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Chat is unavailable until an administrator configures an AI provider.
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Paper
        component="form"
        onSubmit={submit}
        elevation={2}
        sx={{
          p: 1.5,
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,.08)',
          border: 'none',
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={8}
          placeholder="Message YounderChat"
          aria-label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          inputProps={{ maxLength: 12000, 'aria-label': 'Message' }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          sx={{
            '& fieldset': { border: 0 },
            '& .MuiInputBase-root': { p: 0.75 },
            '& .MuiInputBase-input:focus-visible': { outline: 'none' },
            '& textarea::placeholder': { color: 'text.secondary', opacity: 0.7 },
          }}
        />
        {images.length > 0 && (
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ px: 0.75, pt: 0.5 }}>
            {images.map((image) => (
              <Box
                key={image.id}
                sx={{
                  position: 'relative',
                  width: 76,
                  height: 76,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
        {text.length > 8000 && (
          <Typography
            variant="caption"
            color={text.length > 10000 ? 'error' : 'text.secondary'}
            sx={{ alignSelf: 'flex-end', px: 1, display: 'block', textAlign: 'right' }}
          >
            {text.length.toLocaleString()} / 12,000
          </Typography>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mt={0.5}>
          {/* LEFT: attachment + mic */}
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Tooltip title="Add image">
              <span>
                <IconButton
                  aria-label="Add image"
                  size="small"
                  disabled={busy || uploading}
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
            <Tooltip title={listening ? 'Stop voice input' : 'Dictate message'}>
              <span>
                <IconButton
                  aria-label="Voice input"
                  size="small"
                  disabled={busy}
                  color={listening ? 'primary' : 'default'}
                  onClick={dictate}
                >
                  <MicNoneOutlined />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* RIGHT: model selector chip + send/stop */}
          <Stack direction="row" alignItems="center" gap={1}>
            <Tooltip title="Select model">
              <span>
                <Button
                  size="small"
                  disabled={busy}
                  endIcon={<KeyboardArrowDownIcon />}
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  aria-label={`Model: ${selected?.name ?? 'Select'}`}
                  aria-haspopup="listbox"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    borderRadius: 5,
                    px: 1.5,
                    py: 0.5,
                    color: 'text.secondary',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'text.secondary' },
                    minWidth: 0,
                  }}
                >
                  {selected ? shortName(selected.name) : 'Model'}
                </Button>
              </span>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              slotProps={{
                paper: { sx: { maxHeight: MODEL_MENU_HEIGHT, minWidth: 200, overflow: 'hidden' } },
                list: { sx: { maxHeight: MODEL_MENU_HEIGHT, overflowY: 'auto' } },
              }}
            >
              {/* Gemini group */}
              {geminiModels.length > 0 && (
                <ListSubheader disableSticky sx={{ lineHeight: '28px', fontSize: '0.7rem' }}>
                  Gemini
                </ListSubheader>
              )}
              {geminiModels.map((m) => (
                <MenuItem
                  key={m.id}
                  selected={m.id === model}
                  disabled={!m.available}
                  onClick={() => {
                    onModelChange(m.id);
                    setMenuAnchor(null);
                  }}
                  sx={{ fontSize: '0.875rem' }}
                >
                  {shortName(m.name)}
                  {!m.available && (
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                      unavailable
                    </Typography>
                  )}
                </MenuItem>
              ))}
              {/* Groq group */}
              {groqModels.length > 0 && (
                <>
                  <Divider />
                  <ListSubheader disableSticky sx={{ lineHeight: '28px', fontSize: '0.7rem' }}>
                    Groq
                  </ListSubheader>
                </>
              )}
              {groqModels.map((m) => (
                <MenuItem
                  key={m.id}
                  selected={m.id === model}
                  disabled={!m.available}
                  onClick={() => {
                    onModelChange(m.id);
                    setMenuAnchor(null);
                  }}
                  sx={{ fontSize: '0.875rem' }}
                >
                  {shortName(m.name)}
                  {!m.available && (
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                      unavailable
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Menu>
            {busy ? (
              <IconButton
                aria-label="Stop"
                color="primary"
                onClick={onStop}
                disabled={!canStop}
                size="small"
              >
                <StopRounded />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Send message"
                type="submit"
                size="small"
                disabled={(!text.trim() && !images.length) || !enabled || uploading || !selected?.available}
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
        sx={{ fontSize: '0.65rem' }}
      >
        AI can make mistakes. Check important info.
      </Typography>
    </Box>
  );
}
