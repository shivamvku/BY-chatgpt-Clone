import { expect, type Page } from '@playwright/test';

export async function verifyEmail(page: Page) {
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  // Deterministic email fixture is served only by the dedicated browser-test server.
  const email = await page.evaluate(
    async () => (await (await fetch('/api/auth/session')).json()).user.email as string,
  );
  const response = await page.request.get(
    `${process.env.TEST_API_URL || 'http://127.0.0.1:8000'}/__test/email?email=${encodeURIComponent(email)}`,
  );
  const { token } = (await response.json()) as { token: string };
  await page.goto(`/#account/verify/${token}`);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Email verified. You can now sign in.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to YounderChat' }).click();
}
