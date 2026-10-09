import {
  AppBar,
  Box,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { AdminPanel } from './AdminPanel';

export function AdminPage({ onBack }: { onBack: () => void }) {
  return (
    <Box display="flex" flexDirection="column" height="100dvh" overflow="hidden">
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar>
          <IconButton aria-label="Back to chat" onClick={onBack} edge="start" sx={{ mr: 1 }}>
            <ArrowBackOutlined />
          </IconButton>
          <Typography fontWeight={700} flex={1}>
            Admin
          </Typography>
        </Toolbar>
      </AppBar>
      <Box flex={1} overflow="auto">
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <AdminPanel />
        </Container>
      </Box>
    </Box>
  );
}
