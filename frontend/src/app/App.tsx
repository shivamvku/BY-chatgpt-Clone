import { Box, Chip, Container, Stack, Typography } from '@mui/material';

export function App() {
  return (
    <Container maxWidth="md">
      <Stack minHeight="100vh" justifyContent="center" spacing={3}>
        <Chip label="YounderChat · DEVELOPMENT" color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        <Typography variant="h2" fontWeight={700}>A space for better conversations.</Typography>
        <Typography color="text.secondary" variant="h6">React and FastAPI are ready. Authentication and streaming chat are the next milestones.</Typography>
        <Box component="a" href="/api/health/live" sx={{ color: 'primary.main' }}>Check API health</Box>
      </Stack>
    </Container>
  );
}
