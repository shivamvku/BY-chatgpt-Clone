import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';

interface ChatHeaderProps {
  models: any;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  chat: any;
  newChat: () => void;
  user: any;
  onAdminClick: () => void;
}

export function ChatHeader({ 
  models, 
  selectedModel, 
  setSelectedModel, 
  chat, 
  newChat, 
  user, 
  onAdminClick 
}: ChatHeaderProps) {
  const [modelMenu, setModelMenu] = useState<HTMLElement | null>(null);

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    setModelMenu(null);
  }, [setSelectedModel]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" fontWeight={700} color="primary" flex={1}>
        YounderChat
      </Typography>

      {/* Model Selection */}
      {models.data?.configured && models.data.models.length > 0 && (
        <Box>
          <Button
            variant="outlined"
            size="small"
            endIcon={<KeyboardArrowDown />}
            disabled={chat.busy}
            onClick={(e) => setModelMenu(e.currentTarget)}
            sx={{ minWidth: 140 }}
          >
            {models.data.models.find((m: any) => m.id === selectedModel)?.name || 'Select Model'}
          </Button>
          <Menu
            anchorEl={modelMenu}
            open={!!modelMenu}
            onClose={() => setModelMenu(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            {models.data.models.map((model: any) => (
              <MenuItem
                key={model.id}
                selected={model.id === selectedModel}
                onClick={() => handleModelSelect(model.id)}
                sx={{ minWidth: 200 }}
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

      {/* Admin Button */}
      {user?.role === 'admin' && (
        <IconButton
          aria-label="Admin panel"
          onClick={onAdminClick}
          color="primary"
        >
          <AdminPanelSettings />
        </IconButton>
      )}

      {/* New Chat Button */}
      <IconButton
        aria-label="New conversation"
        disabled={chat.busy}
        onClick={newChat}
        color="primary"
      >
        <Add />
      </IconButton>
    </Box>
  );
}