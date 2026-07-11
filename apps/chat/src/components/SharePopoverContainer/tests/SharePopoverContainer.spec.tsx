import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { ShareLinkAccess } from '@epam/ai-dial-share';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useShareLinkModule from '../../../hooks/useShareLink/useShareLink';
import SharePopoverContainer from '../SharePopoverContainer';

vi.mock('../../../hooks/useShareLink/useShareLink');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-share', () => ({
  ShareLinkAccess: { View: 'view', Edit: 'edit' },
  SharePopover: (props: Record<string, unknown>) => (
    <div data-share-props={JSON.stringify(props)} />
  ),
}));

const makeItem = (type: CatalogEntityType): CatalogItem => ({
  id: 'item-1',
  type,
  name: 'Claude',
  version: '1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
});

const mockUseShareLink = (
  overrides: Partial<ReturnType<typeof useShareLinkModule.useShareLink>> = {},
) => {
  vi.mocked(useShareLinkModule.useShareLink).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    setAccess: vi.fn(),
    ...overrides,
  });
};

const getShareProps = (container: HTMLElement) =>
  JSON.parse(
    container
      .querySelector('[data-share-props]')
      ?.getAttribute('data-share-props') ?? '{}',
  );

describe('SharePopoverContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useShareLink with the item id and wires the result to SharePopover', () => {
    mockUseShareLink({
      data: {
        url: 'https://chat.dialx.ai/marketplace/share/item-1',
        expiresInDays: 3,
        access: ShareLinkAccess.View,
      },
    });

    const { container } = render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Application)}
        onClose={vi.fn()}
      />,
    );

    expect(useShareLinkModule.useShareLink).toHaveBeenCalledWith('item-1');

    const props = getShareProps(container);
    expect(props.url).toBe('https://chat.dialx.ai/marketplace/share/item-1');
    expect(props.isLoading).toBe(false);
    expect(props.error).toBeNull();
    expect(props.expiresInDays).toBe(3);
    expect(props.access).toBe(ShareLinkAccess.View);
  });

  it('passes canEditAccess true for an Application item', () => {
    mockUseShareLink();
    const { container } = render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Application)}
        onClose={vi.fn()}
      />,
    );

    expect(getShareProps(container).canEditAccess).toBe(true);
  });

  it('passes canEditAccess false for a Model item', () => {
    mockUseShareLink();
    const { container } = render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Model)}
        onClose={vi.fn()}
      />,
    );

    expect(getShareProps(container).canEditAccess).toBe(false);
  });
});
