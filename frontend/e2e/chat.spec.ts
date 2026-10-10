import { test, expect } from '@playwright/test';
import { verifyEmail } from './account-email';

test('stream, persist, branch, export, archive and delete a conversation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Chat Tester');
  await page
    .getByLabel('Email address')
    .fill(`chat-${Date.now()}-${test.info().project.name}@example.com`);
  await page.getByLabel(/^Password/).fill('chat-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await verifyEmail(page);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Compare my options');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('A useful starting point')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('figure', { name: 'Comparison' })).toBeVisible();
  await page.reload();
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByText('Compare my options', { exact: true }).click();
  await expect(page.getByText('A useful starting point')).toBeVisible();
  await page.getByRole('button', { name: 'Regenerate response' }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
  await expect(page.getByText('2/2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit prompt' }).click();
  await page.getByLabel('Prompt', { exact: true }).fill('A different question');
  await page.getByRole('button', { name: 'Send edited prompt' }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
  await expect(page.getByText('A different question', { exact: true })).toBeVisible();

  // Follow-up prompts must continue from the previous answer, not create a new root.
  const earlierPrompt = page
    .locator('article[data-msg="true"]')
    .filter({ hasText: 'Compare my options' });
  await expect(earlierPrompt).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('What are the next steps?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('What are the next steps?', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden();
  await expect(earlierPrompt).toBeVisible();

  // Verify that the earlier turn remains reachable by scrolling the message pane.
  await page.getByTestId('chat-messages-scroll').evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(earlierPrompt).toBeInViewport();

  await page.screenshot({
    path: `../.codex-tmp/younderchat-chat-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'Actions for Compare my options' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('conversation.json');
  await page.getByRole('button', { name: 'Actions for Compare my options' }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Conversation title').fill('Saved conversation');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Saved conversation' }).click();
  await page.getByRole('menuitem', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toBeHidden();
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'Show archived conversations' }).click();
  await page.getByRole('button', { name: 'Actions for Saved conversation' }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Saved conversation', { exact: true })).toBeHidden();
});

test('shows provider failure and supports stopping a response', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill('Failure Tester');
  await page
    .getByLabel('Email address')
    .fill(`failure-${Date.now()}-${test.info().project.name}@example.com`);
  await page.getByLabel(/^Password/).fill('failure-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await verifyEmail(page);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('simulate failure');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Partial test output', { exact: true })).toBeVisible();
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'New conversation', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Make a plan');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('stopped', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
});
