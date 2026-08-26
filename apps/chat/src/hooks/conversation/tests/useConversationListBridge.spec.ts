import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConversationListBridge,
  OverlayContextType,
} from '../../../context/overlay/OverlayContext';
import { useOptionalOverlay } from '../../../context/overlay/OverlayContext';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../../server-api/conversations.api';
import { ROUTES } from '../../../types/routes';
import { useConversationListBridge } from '../useConversationListBridge';

const mockNavigate = vi.fn();
const mockDeleteConversation = vi.fn();
const mockRenameConversation = vi.fn();
const mockRefreshConversations = vi.fn().mockResolvedValue(undefined);
let mockConversations: ConversationListItemDto[] = [];
let mockSelectedItemId: string | null = 'gpt-4o';

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: vi.fn(),
}));

vi.mock('../../../context/ConversationsContext', () => ({
  useConversations: () => ({
    conversations: mockConversations,
    deleteConversation: mockDeleteConversation,
    renameConversation: mockRenameConversation,
    refreshConversations: mockRefreshConversations,
  }),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ selectedItemId: mockSelectedItemId }),
}));

vi.mock('../../../server-api/conversations.api', () => ({
  createConversation: vi.fn(),
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));

const mockUseOptionalOverlay = vi.mocked(useOptionalOverlay);
const mockApiCreateConversation = vi.mocked(apiCreateConversation);
const mockSaveConversation = vi.mocked(saveConversation);

const makeItem = (
  overrides?: Partial<ConversationListItemDto>,
): ConversationListItemDto => ({
  id: 'conv-1',
  title: 'Existing conversation',
  updatedAt: 1000,
  isPinned: false,
  isReadonly: false,
  sharedWithMe: false,
  publishedWithMe: false,
  isScheduledTask: false,
  ...overrides,
});

/** The overlay protocol does not forward scheduler-only fields — strip them before comparing against bridge output. */
const makeOverlayItem = (overrides?: Partial<ConversationListItemDto>) => {
  const {
    isScheduledTask: _isScheduledTask,
    scheduleId: _scheduleId,
    runId: _runId,
    ...overlayItem
  } = makeItem(overrides);
  return overlayItem;
};

const makeOverlay = (): OverlayContextType & {
  registerConversationListBridge: ReturnType<
    typeof vi.fn<(bridge: ConversationListBridge | null) => void>
  >;
} => ({
  registerActiveConversationBridge: vi.fn(),
  registerConversationListBridge: vi.fn(),
  pendingModelId: null,
  authProviderUiModes: undefined,
  clearPendingModelId: vi.fn(),
  notifyConversationLoaded: vi.fn(),
  notifyConversationsUpdated: vi.fn(),
  notifyGenerationStart: vi.fn(),
  notifyGenerationEnd: vi.fn(),
  notifyStopGenerating: vi.fn(),
});

const getRegisteredBridge = (
  overlay: ReturnType<typeof makeOverlay>,
): ConversationListBridge => {
  const bridge = overlay.registerConversationListBridge.mock.calls.at(-1)?.[0];
  if (!bridge) {
    throw new Error('test setup: no bridge was registered');
  }
  return bridge;
};

describe('useConversationListBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversations = [makeItem()];
    mockSelectedItemId = 'gpt-4o';
  });

  it('does not register a bridge outside overlay mode', () => {
    mockUseOptionalOverlay.mockReturnValue(undefined);
    renderHook(() => useConversationListBridge());
    // Nothing to assert on since useOptionalOverlay returned undefined —
    // the absence of a thrown error/registration call is the behavior.
  });

  it('registers a bridge and unregisters it on unmount', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);

    const { unmount } = renderHook(() => useConversationListBridge());

    expect(overlay.registerConversationListBridge).toHaveBeenCalledWith(
      expect.objectContaining({
        getConversations: expect.any(Function),
        createConversation: expect.any(Function),
        deleteConversation: expect.any(Function),
        renameConversation: expect.any(Function),
        selectConversation: expect.any(Function),
      }),
    );

    unmount();
    expect(overlay.registerConversationListBridge).toHaveBeenLastCalledWith(
      null,
    );
  });

  it('getConversations maps the current list field-for-field', () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);
    mockConversations = [
      makeItem({ id: 'conv-1', title: 'One' }),
      makeItem({ id: 'conv-2', title: 'Two', isPinned: true }),
    ];

    renderHook(() => useConversationListBridge());
    const bridge = getRegisteredBridge(overlay);

    expect(bridge.getConversations()).toEqual([
      makeOverlayItem({ id: 'conv-1', title: 'One' }),
      makeOverlayItem({ id: 'conv-2', title: 'Two', isPinned: true }),
    ]);
  });

  it('selectConversation navigates to the conversation route', async () => {
    const overlay = makeOverlay();
    mockUseOptionalOverlay.mockReturnValue(overlay);

    renderHook(() => useConversationListBridge());
    const bridge = getRegisteredBridge(overlay);

    await bridge.selectConversation('conv-1');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('conv-1'),
    );
  });

  describe('createConversation', () => {
    it('opens the composer without persisting when firstMessage is absent', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.createConversation({});

      expect(response).toEqual({ conversation: null });
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: null,
      });
      expect(mockApiCreateConversation).not.toHaveBeenCalled();
    });

    it('opens the composer with deploymentId passed as router state when firstMessage is blank', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.createConversation({
        deploymentId: 'gpt-4o',
        firstMessage: '   ',
      });

      expect(response).toEqual({ conversation: null });
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: { deploymentId: 'gpt-4o' },
      });
    });

    it('persists immediately and navigates when firstMessage is present', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockApiCreateConversation.mockResolvedValue({
        id: 'new-conv',
        name: 'New conversation',
        updatedAt: 2000,
      } as never);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.createConversation({
        deploymentId: 'gpt-4o',
        firstMessage: 'Hello!',
      });

      expect(mockApiCreateConversation).toHaveBeenCalledWith(
        'Hello!',
        'gpt-4o',
      );
      expect(mockSaveConversation).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('new-conv'),
        expect.anything(),
      );
      expect(mockRefreshConversations).toHaveBeenCalledOnce();
      expect(response).toEqual({
        conversation: {
          id: 'new-conv',
          title: 'New conversation',
          updatedAt: 2000,
          isPinned: false,
          isReadonly: false,
          sharedWithMe: false,
          publishedWithMe: false,
        },
      });
    });

    it('falls back to the selected deployment when deploymentId is omitted', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockSelectedItemId = 'default-model';
      mockApiCreateConversation.mockResolvedValue({
        id: 'new-conv',
        name: 'New conversation',
        updatedAt: 2000,
      } as never);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      await bridge.createConversation({ firstMessage: 'Hello!' });

      expect(mockApiCreateConversation).toHaveBeenCalledWith(
        'Hello!',
        'default-model',
      );
    });

    it('returns INVALID_ARGUMENT when no deployment can be resolved', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockSelectedItemId = null;

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.createConversation({
        firstMessage: 'Hello!',
      });

      expect(response.conversation).toBeNull();
      expect(response.error?.code).toBe('INVALID_ARGUMENT');
      expect(mockApiCreateConversation).not.toHaveBeenCalled();
    });

    it('maps a thrown creation error to a mapped OverlayConversationError', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockApiCreateConversation.mockRejectedValue(new Error('boom'));

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.createConversation({
        deploymentId: 'gpt-4o',
        firstMessage: 'Hello!',
      });

      expect(response.conversation).toBeNull();
      expect(response.error?.code).toBe('NOT_FOUND');
      expect(response.error?.message).toBe('boom');
    });
  });

  describe('deleteConversation', () => {
    it('resolves with no error field on success', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockDeleteConversation.mockResolvedValue(undefined);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.deleteConversation('conv-1');

      expect(mockDeleteConversation).toHaveBeenCalledWith('conv-1');
      expect(response).toEqual({});
    });

    it('maps a thrown error to a mapped OverlayConversationError', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockDeleteConversation.mockRejectedValue(new Error('not allowed'));

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.deleteConversation('conv-1');

      expect(response.error?.message).toBe('not allowed');
    });
  });

  describe('renameConversation', () => {
    it('rejects a blank newName before any network call', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.renameConversation('conv-1', '   ');

      expect(response).toEqual({
        error: {
          code: 'INVALID_ARGUMENT',
          message: expect.any(String),
        },
      });
      expect(mockRenameConversation).not.toHaveBeenCalled();
    });

    it('resolves with the renamed projection on success', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockRenameConversation.mockResolvedValue(undefined);
      mockConversations = [
        makeItem({
          id: 'conversations/bucket/conv-1',
          title: 'Old title',
        }),
      ];

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.renameConversation(
        'bucket/conv-1',
        'New title',
      );

      expect(mockRenameConversation).toHaveBeenCalledWith(
        'bucket/conv-1',
        'New title',
      );
      expect(response.conversation).toEqual(
        makeOverlayItem({
          id: 'conversations/bucket/conv-1',
          title: 'New title',
        }),
      );
      expect(response.error).toBeUndefined();
    });

    it('maps a thrown 404 error to NOT_FOUND', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockRenameConversation.mockRejectedValue({
        response: { status: 404, json: async () => ({ message: 'gone' }) },
      });

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.renameConversation('conv-1', 'New');

      expect(response.error).toEqual({ code: 'NOT_FOUND', message: 'gone' });
    });

    it('maps a thrown 403 error to FORBIDDEN', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockRenameConversation.mockRejectedValue({
        response: {
          status: 403,
          json: async () => ({ message: 'no access' }),
        },
      });

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.renameConversation('conv-1', 'New');

      expect(response.error).toEqual({
        code: 'FORBIDDEN',
        message: 'no access',
      });
    });

    it('maps a thrown 400 error to INVALID_ARGUMENT', async () => {
      const overlay = makeOverlay();
      mockUseOptionalOverlay.mockReturnValue(overlay);
      mockRenameConversation.mockRejectedValue({
        response: {
          status: 400,
          json: async () => ({ message: 'invalid name' }),
        },
      });

      renderHook(() => useConversationListBridge());
      const bridge = getRegisteredBridge(overlay);

      const response = await bridge.renameConversation('conv-1', 'New');

      expect(response.error).toEqual({
        code: 'INVALID_ARGUMENT',
        message: 'invalid name',
      });
    });
  });
});
