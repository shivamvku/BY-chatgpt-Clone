import { expect, it } from 'vitest';
import { getContrastRatio } from '@mui/material/styles';
import { buildTheme } from './tokens';
it('keeps text and primary actions readable in each theme', () => {
  for (const mode of ['light', 'dark'] as const)
    for (const contrast of ['standard', 'high'] as const) {
      const theme = buildTheme(mode, contrast);
      expect(
        getContrastRatio(theme.palette.text.primary, theme.palette.background.paper),
      ).toBeGreaterThan(7);
      expect(
        getContrastRatio(theme.palette.primary.main, theme.palette.primary.contrastText),
      ).toBeGreaterThan(4.5);
    }
});
