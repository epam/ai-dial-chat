import {
  PublicationRule,
  PublicationRuleFunction,
  PublishFolderNode,
} from '@epam/ai-dial-publish-panel';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { DetailsPanel } from '../DetailsPanel';

vi.mock('@epam/ai-dial-kit', () => ({
  TabRow: ({
    tabs,
    onTabChange,
  }: {
    tabs: { id: string; label: string }[];
    onTabChange?: (id: string) => void;
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange?.(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  GhostIconButton: ({
    'aria-label': ariaLabel,
    disabled,
    onClick,
  }: {
    'aria-label': string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    />
  ),
  CloseButton: ({
    onClose,
    ariaLabel,
  }: {
    onClose: () => void;
    ariaLabel: string;
  }) => <button onClick={onClose}>{ariaLabel}</button>,
  Skeleton: () => <div>skeleton</div>,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ConfirmationPopup: ({
    open,
    header,
    description,
    confirmLabel,
    cancelLabel,
    isLoading,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    header?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <span>{header}</span>
        <span>{description}</span>
        <button disabled={isLoading} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button onClick={onCancel}>{cancelLabel}</button>
      </div>
    ) : null,
  DialAccordion: ({
    title,
    children,
  }: {
    title: string;
    children?: React.ReactNode;
  }) => (
    <section>
      <span>{title}</span>
      {children}
    </section>
  ),
}));
vi.mock('@tabler/icons-react', () => ({
  IconChevronLeft: () => <svg />,
  IconChevronDown: () => <svg />,
  IconKey: () => <svg />,
  IconLogin: () => <svg />,
  IconLogout: () => <svg />,
  IconPencil: () => <svg />,
  IconPlayerPlayFilled: () => <svg />,
  IconShare: () => <svg />,
}));
vi.mock('../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({ item }: { item: CatalogItem }) => <div>{item.name}</div>,
}));
vi.mock('../../StarToggleButton/StarToggleButton', () => ({
  StarToggleButton: () => <div>Star</div>,
}));
vi.mock('../Header/Header', () => ({
  Header: ({ onOpenPublish }: { onOpenPublish?: () => void }) => (
    <button onClick={onOpenPublish}>Publish</button>
  ),
}));
vi.mock('../Summary/Summary', () => ({ Summary: () => <div>Summary</div> }));
vi.mock('../TabsContent/About', () => ({
  AboutTab: () => <div>about content</div>,
}));
vi.mock('../TabsContent/Overview', () => ({
  Overview: () => <div>Overview</div>,
}));
vi.mock('../TabsContent/Pricing', () => ({
  Pricing: () => <div>Pricing</div>,
}));
vi.mock('../TabsContent/Limits', () => ({
  LimitsTab: () => <div>Limits content</div>,
}));
vi.mock('../TabsContent/Tools/Tools', () => ({
  Tools: () => <div>Tools</div>,
}));
vi.mock('../ApiDetails', () => ({
  ApiDetails: ({ endpointSectionLabel }: { endpointSectionLabel?: string }) => (
    <div>
      {endpointSectionLabel != null ? `Api:${endpointSectionLabel}` : 'Api'}
    </div>
  ),
}));
vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-publish-panel')>();
  return {
    ...actual,
    PublishPanel: ({
      onSelectedFolderPathChange,
      onCreateFolder,
      rules,
      onRulesChange,
      ruleSourceOptions,
      isRulesLoading,
      hasRulesLoadError,
    }: {
      onSelectedFolderPathChange: (path: string[]) => void;
      onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
      rules: PublicationRule[];
      onRulesChange: (rules: PublicationRule[]) => void;
      ruleSourceOptions: string[];
      isRulesLoading?: boolean;
      hasRulesLoadError?: boolean;
    }) => (
      <div>
        <span>Publish panel</span>
        <span>ruleSourceOptions:{ruleSourceOptions.join(',')}</span>
        <span>rules:{rules.map((r) => r.source).join(',')}</span>
        <span>rulesLoading:{String(isRulesLoading)}</span>
        <span>rulesLoadError:{String(hasRulesLoadError)}</span>
        <button onClick={() => onSelectedFolderPathChange(['Shared'])}>
          Select Shared
        </button>
        <button onClick={() => void onCreateFolder(['Shared'], 'New')}>
          Create folder
        </button>
        <button
          onClick={() =>
            onRulesChange([
              ...rules,
              {
                source: 'role',
                function: PublicationRuleFunction.Contain,
                targets: ['engineering'],
              },
            ])
          }
        >
          Add mock rule
        </button>
      </div>
    ),
    PublishFooter: ({
      onCancel,
      onSubmit,
    }: {
      onCancel: () => void;
      onSubmit: () => void;
    }) => (
      <div>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onSubmit}>Submit</button>
      </div>
    ),
  };
});

const item: CatalogItem = {
  id: '1',
  type: CatalogEntityType.Model,
  name: 'GPT-4o',
  version: '1.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
};

const folderItems: PublishFolderNode[] = [{ path: ['Shared'], name: 'Shared' }];

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  ...overrides,
});

const renderPanel = (props?: Partial<ComponentProps<typeof DetailsPanel>>) =>
  render(
    <DetailsPanel
      item={item}
      isOpen
      onClose={vi.fn()}
      publishFolderItems={folderItems}
      onPublish={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );

describe('DetailsPanel', () => {
  it('renders the details content by default', () => {
    renderPanel();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('shows the Star toggle and hides the back button by default', () => {
    renderPanel();
    expect(screen.getByText('Star')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows the Limits tab when limits data is available', async () => {
    renderPanel({
      item: makeItem({
        details: {
          limits: {
            rows: [{ label: 'Tokens per day', used: 12, total: 20 }],
          },
        },
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByText('Limits content')).toBeTruthy();
  });

  it('labels the resource/endpoint tab "Connect" when API details are available', async () => {
    renderPanel({
      item: makeItem({
        details: {
          api: { resource: { endpointUrl: 'https://dial.example.com/mcp' } },
        },
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByText('Api')).toBeTruthy();
  });

  it('forwards apiEndpointSectionLabel to the Connect tab content', async () => {
    renderPanel({
      item: makeItem({
        details: {
          api: { resource: { endpointUrl: 'https://dial.example.com/mcp' } },
        },
      }),
      texts: { apiEndpointSectionLabel: 'Endpoints' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.getByText('Api:Endpoints')).toBeTruthy();
  });

  it('uses tabConnectLabel to override the Connect tab label', () => {
    renderPanel({
      item: makeItem({
        details: {
          api: { resource: { endpointUrl: 'https://dial.example.com/mcp' } },
        },
      }),
      texts: { tabConnectLabel: 'Endpoint' },
    });

    expect(screen.getByRole('button', { name: 'Endpoint' })).toBeTruthy();
  });

  it('hides the Connect tab when the item has no API details', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('hides the Connect tab when the api data carries no endpoint URL, as for a model', () => {
    renderPanel({
      item: makeItem({
        details: {
          api: {
            resource: { modelId: 'gpt-4o' },
            endpoints: [
              { label: 'Azure OpenAI Endpoint', url: 'https://azure.example' },
            ],
          },
        },
      }),
    });

    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('replaces the details content with the publish panel when Publish is clicked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('Publish panel')).toBeTruthy();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('shows the back button and hides Star while publishing', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByText('Star')).toBeNull();
  });

  it('shows the Close button by default', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('hides the Close button while publishing', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('returns to the details content when the back button is clicked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('returns to the details content when Cancel is clicked in the publish panel', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Summary')).toBeTruthy();
  });

  it('creates publish folders through the shared publish flow', async () => {
    const onCreatePublishFolder = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onCreatePublishFolder });

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Create folder' }),
    );

    expect(onCreatePublishFolder).toHaveBeenCalledWith(['Shared'], 'New');
  });

  it('calls onPublish and onPublishSuccess for the selected folder when the publish panel submits', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const onPublishSuccess = vi.fn();
    renderPanel({ onPublish, onPublishSuccess });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onPublish).toHaveBeenCalledWith(item, ['Shared'], []);
    expect(onPublishSuccess).toHaveBeenCalledWith(item, ['Shared']);
  });

  it('forwards rules added in the publish panel to onPublish', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Add mock rule' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onPublish).toHaveBeenCalledWith(
      item,
      ['Shared'],
      [
        {
          source: 'role',
          function: PublicationRuleFunction.Contain,
          targets: ['engineering'],
        },
      ],
    );
  });

  it('forwards ruleSourceOptions from CatalogProps/DetailsPanelProps down to the publish panel', async () => {
    renderPanel({ ruleSourceOptions: ['roles', 'department'] });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(screen.getByText('ruleSourceOptions:roles,department')).toBeTruthy();
  });

  it('calls onFetchExistingRules on folder selection and pre-fills the editor', async () => {
    const onFetchExistingRules = vi.fn().mockResolvedValue([
      {
        source: 'title',
        function: PublicationRuleFunction.Equal,
        targets: ['Internal Tools'],
      },
    ]);
    renderPanel({ onFetchExistingRules });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    expect(onFetchExistingRules).toHaveBeenCalledWith(['Shared']);
    await waitFor(() => {
      expect(screen.getByText('rules:title')).toBeTruthy();
    });
  });

  it('a rules-lookup failure does not block folder selection or submission', async () => {
    const onFetchExistingRules = vi
      .fn()
      .mockRejectedValue(new Error('network'));
    const onPublish = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onFetchExistingRules, onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    await waitFor(() => {
      expect(screen.getByText('rulesLoadError:true')).toBeTruthy();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onPublish).toHaveBeenCalled();
  });

  it('returns to the details content after a successful publish submit', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByText('Publish panel')).toBeNull();
  });

  it('stays on the publish panel when the publish submit fails', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('network error'));
    const onPublishSuccess = vi.fn();
    renderPanel({ onPublish, onPublishSuccess });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Publish panel')).toBeTruthy();
    expect(screen.queryByText('Summary')).toBeNull();
    expect(onPublishSuccess).not.toHaveBeenCalled();
  });

  it('forwards the rejection reason to onPublishError when the publish submit fails', async () => {
    const rejection = new Error('Failed to fetch');
    const onPublish = vi.fn().mockRejectedValue(rejection);
    const onPublishError = vi.fn();
    renderPanel({ onPublish, onPublishError });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onPublishError).toHaveBeenCalledWith(item, ['Shared'], rejection);
  });

  it('disables the Back button while a publish request is in flight', async () => {
    let resolvePublish: () => void = () => undefined;
    const onPublish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePublish = resolve;
        }),
    );
    renderPanel({ onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(
      screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled'),
    ).toBe(true);
    await act(async () => {
      resolvePublish();
      await Promise.resolve();
    });
  });

  it('shows a loading placeholder next to the tab row when isDetailsLoading is true', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Loading details' }),
    ).toBeTruthy();
  });

  it('does not show a loading placeholder when isDetailsLoading is false', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading={false}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('status', { name: 'Loading details' }),
    ).toBeNull();
  });

  it('uses a custom detailsLoadingAriaLabel', () => {
    render(
      <DetailsPanel
        item={makeItem()}
        isOpen
        isDetailsLoading
        onClose={vi.fn()}
        texts={{ detailsLoadingAriaLabel: 'Fetching details' }}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Fetching details' }),
    ).toBeTruthy();
  });

  it('renders the description on the About tab, not in the summary section', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: { overview: { sections: [] } },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText('about content')).toHaveLength(1);
  });

  it('includes About as the first tab, ahead of the other available tabs', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: { overview: { sections: [] } },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('AboutOverview');
  });

  it('always includes the About tab even when no other tabs are available', () => {
    render(<DetailsPanel item={makeItem()} isOpen onClose={vi.fn()} />);

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('About');
  });

  it('places Connect last even when a Tools tab is also available', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: {
            tools: { tools: [] },
            api: { resource: { endpointUrl: 'https://dial.example.com/mcp' } },
          },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('AboutToolsConnect');
  });

  it('places Connect last among every other available tab', () => {
    render(
      <DetailsPanel
        item={makeItem({
          details: {
            overview: { sections: [] },
            pricing: {},
            limits: { rows: [] },
            api: { resource: { endpointUrl: 'https://dial.example.com/mcp' } },
          },
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist.textContent).toBe('AboutOverviewPricingLimitsConnect');
  });
});
