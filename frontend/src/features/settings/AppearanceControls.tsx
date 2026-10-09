import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useAppearance } from '../../theme/AppearanceProvider';
import type { Appearance, Contrast } from '../../shared/types';

export function AppearanceControls() {
  const { appearance, contrast, setPreferences } = useAppearance();
  return (
    <Stack direction="row" gap={2}>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id="appearance-label">Appearance</InputLabel>
        <Select
          labelId="appearance-label"
          label="Appearance"
          value={appearance}
          onChange={(e) =>
            setPreferences({
              appearance: e.target.value as Appearance,
              contrast,
            })
          }
        >
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
          <MenuItem value="system">System</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id="contrast-label">Contrast</InputLabel>
        <Select
          labelId="contrast-label"
          label="Contrast"
          value={contrast}
          onChange={(e) => setPreferences({ appearance, contrast: e.target.value as Contrast })}
        >
          <MenuItem value="standard">Standard</MenuItem>
          <MenuItem value="high">High</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
