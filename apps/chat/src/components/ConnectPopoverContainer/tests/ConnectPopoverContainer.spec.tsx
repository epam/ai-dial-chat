import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectPopoverContainer from '../ConnectPopoverContainer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { mockUseAppConfig } = vi.hoisted(() => ({
  mockUseAppConfig: vi.fn(),
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: mockUseAppConfig,
}));

const makeItem = (type: CatalogEntityType, id = 'item-1'): CatalogItem => ({
  id,
  type,
  name: 'Item',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
});

describe('ConnectPopoverContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppConfig.mockReturnValue({
      status: 'ready',
      features: {},
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5 * 1024 * 1024,
        defaultDeploymentId: null,
        dialCoreExternalUrl: 'https://dial.example.com',
      },
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows the toolset title and description for a toolset item', () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(CatalogEntityType.Toolset)}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText('catalog.details.connect.toolsetTitle'),
    ).toBeTruthy();
    expect(
      screen.getByText('catalog.details.connect.toolsetDescription'),
    ).toBeTruthy();
  });

  it('shows the application title and description for an application item', () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText('catalog.details.connect.applicationTitle'),
    ).toBeTruthy();
    expect(
      screen.getByText('catalog.details.connect.applicationDescription'),
    ).toBeTruthy();
  });

  it('renders no URL input or read-only field', () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(CatalogEntityType.Toolset)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('copies the toolset MCP URL to the clipboard', async () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(
          CatalogEntityType.Toolset,
          'toolsets/public/search-tool',
        )}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'buttons.copy' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://dial.example.com/v1/toolset/toolsets/public/search-tool/mcp',
    );
  });

  it('copies the application MCP URL to the clipboard for a multi-segment id', async () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(CatalogEntityType.Agent, 'applications/public/my app')}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'buttons.copy' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://dial.example.com/v1/deployments/applications/public/my%20app/mcp',
    );
  });

  it('shows copied feedback and announces it via aria-live after copying', async () => {
    render(
      <ConnectPopoverContainer
        item={makeItem(CatalogEntityType.Toolset)}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'buttons.copy' }));

    expect(
      await screen.findByRole('button', { name: 'buttons.copied' }),
    ).toBeTruthy();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('buttons.copied');
  });
});
