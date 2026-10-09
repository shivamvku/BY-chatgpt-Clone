import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Alert,
  Box,
  Divider,
  IconButton,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
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
    [uploading, setUploading] = useState(false),
    [listening, setListening] = useState(false),
    [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null),
    recognition = useRef<SpeechRecognitionLike | null>(null);
  const selected = models.find((item) => item.id === model);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || busy || !enabled || uploading || !selected?.available) return;
    if (await onSend(text)) setText('');
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
      setText((value) => `${value}\n![Attached image](${image.url})\n`);
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
        elevation={0}
        variant="outlined"
        sx={{ p: 1.25, borderRadius: 4, boxShadow: '0 8px 28px rgba(0,0,0,.06)' }}
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
          sx={{ '& fieldset': { border: 0 }, '& .MuiInputBase-root': { p: 0.75 }, '& textarea::placeholder': { color: 'text.secondary', opacity: 0.7 } }}
        />
        {text.length > 0 && (
          <Typography
            variant="caption"
            color={text.length > 10000 ? 'error' : 'text.secondary'}
            sx={{ alignSelf: 'flex-end', px: 1, display: 'block', textAlign: 'right' }}
          >
            {text.length.toLocaleString()} / 12,000
          </Typography>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Tooltip title="Add image">
              <span>
                <IconButton
                  aria-label="Add image"
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
                  disabled={busy}
                  color={listening ? 'primary' : 'default'}
                  onClick={dictate}
                >
                  <MicNoneOutlined />
                </IconButton>
              </span>
            </Tooltip>
            <Select
              value={model}
              size="small"
              disabled={busy}
              onChange={(event) => onModelChange(event.target.value)}
              inputProps={{ 'aria-label': 'AI model' }}
              sx={{ minWidth: 200 }}
            >
              {/* Auto always first */}
              {models
                .filter((m) => m.id === 'auto')
                .map((m) => (
                  <MenuItem key={m.id} value={m.id} disabled={!m.available}>
                    {m.name}
                  </MenuItem>
                ))}
              {/* Gemini group */}
              {models.some((m) => m.id !== 'auto' && m.name.toLowerCase().includes('gemini')) && (
                <ListSubheader disableSticky sx={{ lineHeight: '28px', fontSize: '0.7rem' }}>
                  Gemini
                </ListSubheader>
              )}
              {models
                .filter((m) => m.id !== 'auto' && m.name.toLowerCase().includes('gemini'))
                .map((m) => (
                  <MenuItem key={m.id} value={m.id} disabled={!m.available}>
                    {m.name}
                    {!m.available ? ' (unavailable)' : ''}
                  </MenuItem>
                ))}
              {/* Groq group */}
              {models.some((m) => m.name.toLowerCase().includes('groq')) && (
                [
                  <Divider key="groq-divider" />,
                  <ListSubheader key="groq-header" disableSticky sx={{ lineHeight: '28px', fontSize: '0.7rem' }}>
                    Groq
                  </ListSubheader>,
                ]
              )}
              {models
                .filter((m) => m.name.toLowerCase().includes('groq'))
                .map((m) => (
                  <MenuItem key={m.id} value={m.id} disabled={!m.available}>
                    {m.name.replace('Groq · ', '')}
                    {!m.available ? ' (unavailable)' : ''}
                  </MenuItem>
                ))}
            </Select>
          </Stack>
          {busy ? (
            <IconButton aria-label="Stop" color="primary" onClick={onStop} disabled={!canStop}>
              <StopRounded />
            </IconButton>
          ) : (
            <IconButton
              aria-label="Send message"
              type="submit"
              disabled={!text.trim() || !enabled || uploading || !selected?.available}
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
        AI can make mistakes. Check important information. Uploaded images are private and are not
        sent to the model.
      </Typography>
    </Box>
  );
}
