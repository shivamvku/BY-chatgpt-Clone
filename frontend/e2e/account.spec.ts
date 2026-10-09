import { test, expect } from '@playwright/test';
test('register, save appearance, reload and revoke sessions', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({
    path: `../.codex-tmp/younderchat-auth-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Browser User');
  await page
    .getByLabel('Email address')
    .fill(`browser-${Date.now()}-${test.info().project.name}@example.com`);
  await page.getByLabel(/^Password/).fill('browser-password-123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What will you explore today?' })).toBeVisible();
  await page.screenshot({
    path: `../.codex-tmp/younderchat-workspace-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'Browser User' }).click();
  await page.getByLabel('Display name').fill('Saved User');
  await page.getByLabel('Appearance', { exact: true }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Contrast', { exact: true }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.getByRole('button', { name: 'Save profile and appearance' }).click();
  await expect(page.getByText('Preferences saved')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What will you explore today?' })).toBeVisible();
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'Saved User' }).click();
  await expect(page.getByLabel('Appearance', { exact: true })).toHaveText('Dark');
  await page.screenshot({
    path: `../.codex-tmp/younderchat-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Sign out all devices' }).click();
  await expect(page.getByRole('tab', { name: 'Sign in', exact: true })).toBeVisible();
});
