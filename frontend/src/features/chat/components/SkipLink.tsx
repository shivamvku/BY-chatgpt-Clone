import { Box } from '@mui/material';

export function SkipLink() {
  return (
    <Box
      component="a"
      href="#composer"
      sx={{
        position: 'absolute',
        left: -9999,
        '&:focus': {
          left: 16,
          top: 16,
          zIndex: 2000,
          bgcolor: 'background.paper',
          p: 2,
          borderRadius: 1,
          textDecoration: 'none',
          color: 'primary.main',
          boxShadow: 2,
        },
      }}
    >
      Skip to message composer
    </Box>
  );
}