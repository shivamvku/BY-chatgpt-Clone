import { createTheme } from '@mui/material/styles';
import type { Contrast } from '../shared/types';

export function buildTheme(mode: 'light' | 'dark', contrast: Contrast) {
  const dark = mode === 'dark';
  const high = contrast === 'high';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? '#80c7ff' : '#0055b8',
        contrastText: dark ? '#071a30' : '#fff',
      },
      secondary: { main: dark ? '#b6afff' : '#6550b5' },
      background: {
        default: dark ? (high ? '#000' : '#091525') : '#f6f8fc',
        paper: dark ? '#102238' : '#fff',
      },
      text: {
        primary: dark ? '#f4f8ff' : '#102b4c',
        secondary: dark ? '#b6c8df' : '#465d78',
      },
      divider: dark ? (high ? '#b6c8df' : '#28415c') : high ? '#465d78' : '#dae3ef',
    },
    typography: {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-.035em' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCssBaseline: {
        styleOverrides: {
          ':focus-visible': {
            outline: `3px solid ${dark ? '#80c7ff' : '#0055b8'}`,
            outlineOffset: 3,
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
              scrollBehavior: 'auto !important',
            },
          },
          body: { margin: 0 },
          '::-webkit-scrollbar': { width: '6px', height: '6px' },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: dark ? '#28415c' : '#c5d0de',
            borderRadius: '3px',
          },
          a: { textDecorationColor: 'inherit' },
        },
      },
    },
  });
}
