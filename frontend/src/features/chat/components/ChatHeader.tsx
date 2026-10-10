import { Box, Typography } from '@mui/material';

export function ChatHeader() {
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
    </Box>
  );
}
