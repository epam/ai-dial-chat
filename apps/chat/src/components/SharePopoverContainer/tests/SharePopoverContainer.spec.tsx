import { type CatalogItem } from '@epam/ai-dial-catalog';
import * as chatHooksModule from '@epam/ai-dial-chat-hooks';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { ShareLinkAccess, type SharePopoverProps } from '@epam/ai-dial-share';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ShareI18nKeys,
} from '../../../constants/translation-keys';
import { shareApi } from '../../../server-api/api-client';
import SharePopoverContainer from '../SharePopoverContainer';

const { mockSharePopover, mockT } = vi.hoisted(() => ({
  mockSharePopover: vi.fn((_props: SharePopoverProps) => null),
  mockT: vi.fn((key: string, _options?: Record<string, unknown>) => key),
}));

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return { ...actual, useShareLink: vi.fn() };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
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
  overrides: Partial<ReturnType<typeof chatHooksModule.useShareLink>> = {},
) => {
  vi.mocked(chatHooksModule.useShareLink).mockReturnValue({
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
        url: 'https://example.com/marketplace/share/item-1',
        expiresInDays: 3,
        access: [ShareLinkAccess.View],
      },
    });

    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );

    expect(chatHooksModule.useShareLink).toHaveBeenCalledWith(
      shareApi,
      'item-1',
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/marketplace/share/item-1',
        isLoading: false,
        error: null,
        access: [ShareLinkAccess.View],
        labels: expect.objectContaining({
          expiryNote: ShareI18nKeys.ExpiryNote,
        }),
      }),
      undefined,
    );
  });

  it('passes no expiry note when the share link has no expiresInDays', () => {
    mockUseShareLink({
      data: {
        url: 'https://example.com/marketplace/share/item-1',
        access: [ShareLinkAccess.View],
      },
    });

    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/marketplace/share/item-1',
        labels: expect.objectContaining({ expiryNote: undefined }),
      }),
      undefined,
    );
    expect(mockT).not.toHaveBeenCalledWith(
      ShareI18nKeys.ExpiryNote,
      expect.anything(),
    );
  });

  it('builds the expiry note from the expiresInDays reported by DIAL Core', () => {
    mockUseShareLink({
      data: {
        url: 'https://example.com/marketplace/share/item-1',
        expiresInDays: 7,
        access: [ShareLinkAccess.View],
      },
    });

    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );

    expect(mockT).toHaveBeenCalledWith(ShareI18nKeys.ExpiryNote, { days: 7 });
  });

  it('passes canEditAccess true for an Application item', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAccess: true }),
      undefined,
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
      undefined,
    );
  });

  it('calls useShareLink with the item id for a prompt, same as any other type', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Prompt)}
        onClose={vi.fn()}
      />,
    );

    expect(chatHooksModule.useShareLink).toHaveBeenCalledWith(
      shareApi,
      'item-1',
    );
  });

  it('omits the nested-items note by default', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({ nestedItemsNote: undefined }),
      }),
      undefined,
    );
  });

  it('passes the nested-items note when isQuickApp is true', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Agent)}
        isQuickApp
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({
          nestedItemsNote: ShareI18nKeys.NestedItemsNote,
        }),
      }),
      undefined,
    );
  });

  it('passes canEditAccess true for a prompt', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Prompt)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAccess: true }),
      undefined,
    );
  });

  it('passes translated QR copy and download labels to SharePopover', () => {
    mockUseShareLink();
    render(
      <SharePopoverContainer
        item={makeItem(CatalogEntityType.Model)}
        onClose={vi.fn()}
      />,
    );

    expect(mockSharePopover).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: expect.objectContaining({
          qrCopyButtonLabel: ButtonsI18nKeys.Copy,
          qrCopiedButtonLabel: ShareI18nKeys.CopiedButtonLabel,
          qrDownloadButtonLabel: ButtonsI18nKeys.Download,
          qrDownloadFileName: ShareI18nKeys.QrDownloadFileName,
        }),
      }),
      undefined,
    );
  });
});
