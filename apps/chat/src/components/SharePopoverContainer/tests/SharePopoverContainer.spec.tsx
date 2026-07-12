import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { ShareLinkAccess, type SharePopoverProps } from '@epam/ai-dial-share';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareI18nKeys } from '../../../constants/translation-keys';
import * as useShareLinkModule from '../../../hooks/useShareLink/useShareLink';
import SharePopoverContainer from '../SharePopoverContainer';

const { mockSharePopover } = vi.hoisted(() => ({
  mockSharePopover: vi.fn((_props: SharePopoverProps) => null),
}));

vi.mock('../../../hooks/useShareLink/useShareLink');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@epam/ai-dial-share', () => ({
  ShareLinkAccess: { View: 'view', Edit: 'edit' },
  SharePopover: mockSharePopover,
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

describe('SharePopoverContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls useShareLink with the item id and wires the result to SharePopover', () => {
    mockUseShareLink({
      data: {
        url: 'https://chat.dialx.ai/marketplace/share/item-1',
        expiresInDays: 3,
        access: [ShareLinkAccess.View],
      },
    });

    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Application)}
        onClose={vi.fn()}
      />,
    );

    expect(useShareLinkModule.useShareLink).toHaveBeenCalledWith('item-1');

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://chat.dialx.ai/marketplace/share/item-1',
        isLoading: false,
        error: null,
        access: [ShareLinkAccess.View],
        labels: expect.objectContaining({
          expiryNote: ShareI18nKeys.ExpiryNote,
        }),
      }),
    );
  });

  it('passes canEditAccess true for an Application item', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Application)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAccess: true }),
    );
  });

  it('passes canEditAccess false for a Model item', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Model)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAccess: false }),
    );
  });
});
