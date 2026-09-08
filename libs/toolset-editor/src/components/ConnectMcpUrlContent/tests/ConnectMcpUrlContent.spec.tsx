import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ConnectMcpUrlContent from '../ConnectMcpUrlContent';

const MCP_URL = 'https://dial-core.example.com/v1/toolset/my-toolset/mcp';

const renderContent = (url: string = MCP_URL) =>
  render(<ConnectMcpUrlContent url={url} />);

describe('ConnectMcpUrlContent', () => {
  it('renders the default title, description, and copy button', () => {
    renderContent();
    expect(screen.getByText('Connect toolset')).toBeTruthy();
    expect(
      screen.getByText(
        'Copy endpoint URL to easily integrate toolset into your workflows',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy URL' }),
    ).toBeTruthy();
  });

  it('renders host-supplied labels instead of the defaults', () => {
    render(
      <ConnectMcpUrlContent
        url={MCP_URL}
        labels={{
          title: 'Connecter le toolset',
          description: 'Copiez le endpoint',
          copyLabel: 'Copier',
          copiedLabel: 'Copié !',
        }}
      />,
    );
    expect(screen.getByText('Connecter le toolset')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy();
  });

  it('copies the endpoint URL to the clipboard', async () => {
    /* `userEvent.setup()` installs the clipboard stub jsdom lacks. */
    const user = userEvent.setup({ delay: null });

    renderContent();

    await user.click(screen.getByRole('button', { name: 'Copy URL' }));

    await expect(navigator.clipboard.readText()).resolves.toBe(MCP_URL);
  });

  it('announces the copy through the polite live region', async () => {
    const user = userEvent.setup({ delay: null });

    renderContent();

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');

    await user.click(screen.getByRole('button', { name: 'Copy URL' }));

    await waitFor(() => expect(status.textContent).toBe('Copied!'));
  });
});
