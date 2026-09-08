import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ButtonsI18nKeys } from '../../../constants/translation-keys';
import ConnectMcpUrlContent from '../ConnectMcpUrlContent';

const MCP_URL = 'https://dial-core.example.com/v1/toolset/my-toolset/mcp';

describe('ConnectMcpUrlContent', () => {
  it('copies the endpoint URL to the clipboard', async () => {
    /* `userEvent.setup()` installs the clipboard stub jsdom lacks. */
    const user = userEvent.setup({ delay: null });

    render(
      <ConnectMcpUrlContent
        entityType={CatalogEntityType.Toolset}
        url={MCP_URL}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Copy }),
    );

    await expect(navigator.clipboard.readText()).resolves.toBe(MCP_URL);
  });

  it('announces the copy through the polite live region', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <ConnectMcpUrlContent
        entityType={CatalogEntityType.Toolset}
        url={MCP_URL}
      />,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');

    await user.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Copy }),
    );

    await waitFor(() =>
      expect(status.textContent).toBe(ButtonsI18nKeys.Copied),
    );
  });
});
