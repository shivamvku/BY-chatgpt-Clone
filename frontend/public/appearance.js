// Set browser canvas before React loads; only non-sensitive preferences are stored locally.
try {
  const preferences = JSON.parse(localStorage.getItem('yc-appearance') || '{}');
  const dark = preferences.appearance === 'dark' || ((!preferences.appearance || preferences.appearance === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.style.background = dark ? (preferences.contrast === 'high' ? '#000' : '#091525') : '#f6f8fc';
} catch { /* Use the browser's default canvas when storage is unavailable. */ }
