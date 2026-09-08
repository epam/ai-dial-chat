import type { CatalogItem } from '@epam/ai-dial-catalog';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discardSharedCatalogItem,
  getShareRecipientsCount,
  revokeSharedAccess,
} from '../../../server-api/share.api';
import { useUiFeature } from '../../useUiFeature';
import { useCatalogSharing } from '../useCatalogSharing';

vi.mock('../../../server-api/share.api', () => ({
  discardSharedCatalogItem: vi.fn(),
  revokeSharedAccess: vi.fn(),
  getShareRecipientsCount: vi.fn(),
}));

vi.mock('../../useUiFeature', () => ({
  useUiFeature: vi.fn(),
}));

/* Matches the global `react-i18next` mock (`t(key) => key`) used by every other spec in this app. */
const t = ((key: string) => key) as unknown as TFunction;

const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: 'tool-abc123',
  type: CatalogEntityType.Toolset,
  name: 'My toolset',
  version: '1.2.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  ...overrides,
});

const renderSharing = (
  overrides: Partial<Parameters<typeof useCatalogSharing>[0]> = {},
) => {
  const refetchToolsets = vi.fn().mockResolvedValue(undefined);
  const refetchSkills = vi.fn().mockResolvedValue(undefined);
  const refetchPrompts = vi.fn().mockResolvedValue(undefined);
  const refetchDeployments = vi.fn().mockResolvedValue(undefined);
  const setSelectedItemId = vi.fn();
  const showSuccessNotification = vi.fn();
  const showErrorNotification = vi.fn();
  const view = renderHook(() =>
    useCatalogSharing({
      t,
      refetchToolsets,
      refetchSkills,
      refetchPrompts,
      refetchDeployments,
      selectedItemId: null,
      setSelectedItemId,
      showSuccessNotification,
      showErrorNotification,
      ...overrides,
    }),
  );
  return {
    ...view,
    refetchToolsets,
    refetchSkills,
    refetchPrompts,
    refetchDeployments,
    setSelectedItemId,
    showSuccessNotification,
    showErrorNotification,
  };
};

describe('useCatalogSharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUiFeature).mockReturnValue(true);
  });

  describe('isShareVisible', () => {
    it('shows Share for a toolset item when toolsets-sharing is enabled', () => {
      vi.mocked(useUiFeature).mockReturnValue(true);
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(true);
    });

    it('hides Share for a toolset item when toolsets-sharing is disabled', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) => feature !== OverlayFeature.ToolsetsSharing,
      );
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(false);
    });

    it('hides Share for an application item when applications-sharing is disabled, independent of toolsets-sharing', () => {
      vi.mocked(useUiFeature).mockImplementation(
        (feature) => feature !== OverlayFeature.ApplicationsSharing,
      );
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Agent }),
        ),
      ).toBe(false);
      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(true);
    });

    it('shows Share for a prompt the user owns', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt, isMyApp: true }),
        ),
      ).toBe(true);
    });

    it('hides Share for a prompt the user does not own', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt, isMyApp: false }),
        ),
      ).toBe(false);
    });

    it('shows Share for a skill the user owns', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Skill, isMyApp: true }),
        ),
      ).toBe(true);
    });

    /*
     * Same ownership rule as prompts: a skill shared with WRITE permission
     * (`isEditable: true`) must not become re-shareable merely from holding
     * that permission — only the owner can share.
     */
    it('hides Share for a writable shared skill, even though it is editable', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({
            type: CatalogEntityType.Skill,
            isMyApp: false,
            sharedWithMe: true,
            isEditable: true,
          }),
        ),
      ).toBe(false);
    });

    it('hides Share for a read-only shared skill', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({
            type: CatalogEntityType.Skill,
            isMyApp: false,
            sharedWithMe: true,
            isEditable: false,
          }),
        ),
      ).toBe(false);
    });

    it('hides Share for a public skill', () => {
      const { result } = renderSharing();

      expect(
        result.current.isShareVisible(
          makeCatalogItem({
            type: CatalogEntityType.Skill,
            isMyApp: false,
            sharedWithMe: false,
            isEditable: false,
          }),
        ),
      ).toBe(false);
    });
  });

  describe('isUnshareVisible / isRevokeShareVisible', () => {
    it('is visible for every catalog item type, prompts included', () => {
      const { result } = renderSharing();

      expect(
        result.current.isUnshareVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt }),
        ),
      ).toBe(true);
      expect(
        result.current.isRevokeShareVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt }),
        ),
      ).toBe(true);
    });
  });

  describe('handleUnshare', () => {
    it('removes a shared toolset, refetches toolsets (not deployments), and shows a success notification', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const {
        result,
        refetchToolsets,
        refetchDeployments,
        showSuccessNotification,
      } = renderSharing();
      const item = makeCatalogItem({
        id: 'toolsets/other-bucket/search__0.0.1',
        type: CatalogEntityType.Toolset,
      });

      await result.current.handleUnshare(item);

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(item.id);
      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('removes a shared application, refetches deployments (not toolsets), and shows a success notification', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const {
        result,
        refetchToolsets,
        refetchDeployments,
        showSuccessNotification,
      } = renderSharing();
      const item = makeCatalogItem({
        id: 'applications/other-bucket/Their App__1.0',
        type: CatalogEntityType.Agent,
      });

      await result.current.handleUnshare(item);

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(item.id);
      expect(refetchDeployments).toHaveBeenCalledOnce();
      expect(refetchToolsets).not.toHaveBeenCalled();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('removes a shared prompt and refetches prompts', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const { result, refetchPrompts, showSuccessNotification } =
        renderSharing();
      const item = makeCatalogItem({
        id: 'prompts/owner-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
      });

      await result.current.handleUnshare(item);

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(item.id);
      expect(refetchPrompts).toHaveBeenCalledOnce();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('removes a shared skill and refetches skills', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const { result, refetchSkills, showSuccessNotification } =
        renderSharing();
      const item = makeCatalogItem({
        id: 'skills/owner-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
      });

      await result.current.handleUnshare(item);

      expect(discardSharedCatalogItem).toHaveBeenCalledWith(item.id);
      expect(refetchSkills).toHaveBeenCalledOnce();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('shows an error notification and does not refetch skills when discardSharedCatalogItem rejects for a skill', async () => {
      vi.mocked(discardSharedCatalogItem).mockRejectedValue(
        new Error('network error'),
      );
      const { result, refetchSkills, showErrorNotification } = renderSharing();
      const item = makeCatalogItem({
        id: 'skills/owner-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
      });

      await expect(result.current.handleUnshare(item)).rejects.toThrow(
        'network error',
      );

      expect(refetchSkills).not.toHaveBeenCalled();
      expect(showErrorNotification).toHaveBeenCalled();
    });

    it('clears the selection when removing the currently selected deployment', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'applications/other-bucket/Their App__1.0',
        type: CatalogEntityType.Agent,
      });
      const { result, setSelectedItemId } = renderSharing({
        selectedItemId: item.id,
      });

      await result.current.handleUnshare(item);

      expect(setSelectedItemId).toHaveBeenCalledWith(null);
    });

    it('leaves the selection untouched when removing a non-selected item', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'applications/other-bucket/Their App__1.0',
        type: CatalogEntityType.Agent,
      });
      const { result, setSelectedItemId } = renderSharing({
        selectedItemId: 'gpt-4o',
      });

      await result.current.handleUnshare(item);

      expect(setSelectedItemId).not.toHaveBeenCalled();
    });

    it('shows an error notification and skips refetch/selection-clear when discardSharedCatalogItem rejects', async () => {
      vi.mocked(discardSharedCatalogItem).mockRejectedValue(
        new Error('network error'),
      );
      const item = makeCatalogItem({
        id: 'applications/other-bucket/Their App__1.0',
        type: CatalogEntityType.Agent,
      });
      const {
        result,
        refetchDeployments,
        setSelectedItemId,
        showErrorNotification,
      } = renderSharing({ selectedItemId: item.id });

      await expect(result.current.handleUnshare(item)).rejects.toThrow(
        'network error',
      );

      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(showErrorNotification).toHaveBeenCalled();
    });

    it('preserves mutation success when the subsequent refetch rejects', async () => {
      vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'applications/other-bucket/Their App__1.0',
        type: CatalogEntityType.Agent,
      });
      const refetchDeployments = vi
        .fn()
        .mockRejectedValue(new Error('refresh failed'));
      const {
        result,
        setSelectedItemId,
        showSuccessNotification,
        showErrorNotification,
      } = renderSharing({ selectedItemId: item.id, refetchDeployments });

      await result.current.handleUnshare(item);

      expect(refetchDeployments).toHaveBeenCalledOnce();
      expect(setSelectedItemId).toHaveBeenCalledWith(null);
      expect(showSuccessNotification).toHaveBeenCalled();
      expect(showErrorNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleRevokeShare', () => {
    it('revokes access and notifies, without refetching or clearing selection', async () => {
      vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'applications/my-bucket/My App__1.0',
        isMyApp: true,
      });
      const {
        result,
        refetchToolsets,
        refetchDeployments,
        setSelectedItemId,
        showSuccessNotification,
      } = renderSharing({ selectedItemId: item.id });

      await result.current.handleRevokeShare(item);

      expect(revokeSharedAccess).toHaveBeenCalledWith(item.id);
      expect(refetchToolsets).not.toHaveBeenCalled();
      expect(refetchDeployments).not.toHaveBeenCalled();
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('shows an error notification carrying the trace id when revokeSharedAccess rejects', async () => {
      vi.mocked(revokeSharedAccess).mockRejectedValue(
        new Error('network error'),
      );
      const item = makeCatalogItem({
        id: 'applications/my-bucket/My App__1.0',
      });
      const { result, showSuccessNotification, showErrorNotification } =
        renderSharing();

      await expect(result.current.handleRevokeShare(item)).rejects.toThrow(
        'network error',
      );

      expect(showErrorNotification).toHaveBeenCalled();
      expect(showSuccessNotification).not.toHaveBeenCalled();
    });

    it('revokes access to an owned prompt without refetching prompts', async () => {
      vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
        isMyApp: true,
      });
      const { result, refetchPrompts, showSuccessNotification } =
        renderSharing();

      await result.current.handleRevokeShare(item);

      expect(revokeSharedAccess).toHaveBeenCalledWith(item.id);
      expect(refetchPrompts).not.toHaveBeenCalled();
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('revokes access to an owned skill without refetching skills', async () => {
      vi.mocked(revokeSharedAccess).mockResolvedValue({ success: true });
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        isMyApp: true,
      });
      const { result, refetchSkills, showSuccessNotification } =
        renderSharing();

      await result.current.handleRevokeShare(item);

      expect(revokeSharedAccess).toHaveBeenCalledWith(item.id);
      expect(refetchSkills).not.toHaveBeenCalled();
      expect(showSuccessNotification).toHaveBeenCalled();
    });
  });

  describe('handleFetchRecipientsCount', () => {
    it('resolves the recipient count for the item asked about', async () => {
      vi.mocked(getShareRecipientsCount).mockResolvedValue({
        itemId: 'applications/my-bucket/My App__1.0',
        recipientsCount: 4,
      });
      const item = makeCatalogItem({
        id: 'applications/my-bucket/My App__1.0',
      });
      const { result } = renderSharing();

      const count = await result.current.handleFetchRecipientsCount(item);

      expect(getShareRecipientsCount).toHaveBeenCalledWith(item.id);
      expect(count).toBe(4);
    });

    it('propagates a failed recipient-count lookup without notifying', async () => {
      vi.mocked(getShareRecipientsCount).mockRejectedValue(new Error('503'));
      const item = makeCatalogItem({
        id: 'applications/my-bucket/My App__1.0',
      });
      const { result, showErrorNotification } = renderSharing();

      await expect(
        result.current.handleFetchRecipientsCount(item),
      ).rejects.toThrow('503');

      expect(showErrorNotification).not.toHaveBeenCalled();
    });
  });
});
