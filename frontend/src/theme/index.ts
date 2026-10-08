import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: { mode: 'dark', primary: { main: '#7dd3fc' }, background: { default: '#101318', paper: '#191e26' } },
  typography: { fontFamily: 'Inter, system-ui, sans-serif' },
  shape: { borderRadius: 12 },
});
