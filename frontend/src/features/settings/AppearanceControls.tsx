import { useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { api } from '../../shared/api';
import type { Appearance, Contrast, User } from '../../shared/types';
import { useAuth } from '../auth/AuthProvider';
import { useAppearance } from '../../theme/AppearanceProvider';
import { SettingRow } from './SectionCard';

export function AppearanceControls({ onError }: { onError?: (message: string) => void }) {
  const { appearance, contrast, setPreferences } = useAppearance();
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  // Preferences apply immediately and are persisted to the account in the background.
  async function apply(next: { appearance: Appearance; contrast: Contrast }) {
    setPreferences(next);
    if (!user) return;
    setSaving(true);
    try {
      updateUser(
        await api<User>('/auth/profile', 'PATCH', {
          name: user.name,
          bio: user.bio,
          timezone: user.timezone,
          appearance: next.appearance,
          contrast: next.contrast,
        }),
      );
    } catch (failure) {
      onError?.((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Stack spacing={2.5}>
      <SettingRow
        description="Light, dark, or follow your system setting. New visitors start on system."
        control={
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="appearance-select-label">Appearance</InputLabel>
            <Select
              labelId="appearance-select-label"
              label="Appearance"
              value={appearance}
              disabled={saving}
              onChange={(e) => void apply({ appearance: e.target.value as Appearance, contrast })}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        }
      />
      <SettingRow
        description="High contrast strengthens text and borders."
        control={
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="contrast-select-label">Contrast</InputLabel>
            <Select
              labelId="contrast-select-label"
              label="Contrast"
              value={contrast}
              disabled={saving}
              onChange={(e) => void apply({ appearance, contrast: e.target.value as Contrast })}
            >
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
        }
      />
    </Stack>
  );
}
