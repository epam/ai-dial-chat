import { MessageRole } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDeployments } from '../../context/DeploymentsContext';
import { useDeploymentChangeEffect } from '../useDeploymentChangeEffect';

vi.mock('../../context/DeploymentsContext', () => ({
  useDeployments: vi.fn(),
}));

const mockUseDeployments = vi.mocked(useDeployments);

const makeDeploymentsContext = (selectedItemId: string | null) => ({
  items: [],
  selectedItemId,
  setSelectedItemId: vi.fn(),
  restoreSelectedItemId: vi.fn(),
  selectedDeploymentConfiguration: null,
  isLoading: false,
  error: null,
  schemas: [],
  toolsets: [],
});

describe('useDeploymentChangeEffect', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not call addStatusMessage on initial mount', () => {
    mockUseDeployments.mockReturnValue(makeDeploymentsContext('gpt-4'));
    const addStatusMessage = vi.fn();

    renderHook(() =>
      useDeploymentChangeEffect('conv-1', addStatusMessage, true),
    );

    expect(addStatusMessage).not.toHaveBeenCalled();
  });

  it('calls addStatusMessage when selectedItemId changes after load', () => {
    let selectedItemId = 'gpt-3';
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect('conv-1', addStatusMessage, true),
    );

    act(() => {
      selectedItemId = 'gpt-4';
    });
    rerender();

    expect(addStatusMessage).toHaveBeenCalledTimes(1);
    const msg = addStatusMessage.mock.calls[0][0];
    expect(msg.role).toBe(MessageRole.Status);
    expect(msg.deploymentId).toBe('gpt-4');
  });

  it('does not call addStatusMessage when conversationId is undefined', () => {
    let selectedItemId = 'gpt-3';
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect(undefined, addStatusMessage, true),
    );

    act(() => {
      selectedItemId = 'gpt-4';
    });
    rerender();

    expect(addStatusMessage).not.toHaveBeenCalled();
  });

  it('does not call addStatusMessage when selectedItemId changes to null', () => {
    let selectedItemId: string | null = 'gpt-3';
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect('conv-1', addStatusMessage, true),
    );

    act(() => {
      selectedItemId = null;
    });
    rerender();

    expect(addStatusMessage).not.toHaveBeenCalled();
  });

  it('does not call addStatusMessage while conversation is not loaded', () => {
    let selectedItemId = 'gpt-3';
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect('conv-1', addStatusMessage, false),
    );

    act(() => {
      selectedItemId = 'gpt-4';
    });
    rerender();

    expect(addStatusMessage).not.toHaveBeenCalled();
  });

  it('does not call addStatusMessage for the deployment restored on load', () => {
    // Simulate: default agent is gpt-3, but conversation history had gpt-4.
    // Caller sets selectedItemId to gpt-4 before isConversationLoaded becomes true,
    // both changes arrive in the same render.
    let selectedItemId = 'gpt-3';
    let isConversationLoaded = false;
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect(
        'conv-1',
        addStatusMessage,
        isConversationLoaded,
      ),
    );

    // Conversation loads; caller restores last agent simultaneously
    act(() => {
      selectedItemId = 'gpt-4';
      isConversationLoaded = true;
    });
    rerender();

    expect(addStatusMessage).not.toHaveBeenCalled();
  });

  it('calls addStatusMessage when user switches agent after load', () => {
    let selectedItemId = 'gpt-3';
    let isConversationLoaded = false;
    mockUseDeployments.mockImplementation(() =>
      makeDeploymentsContext(selectedItemId),
    );
    const addStatusMessage = vi.fn();

    const { rerender } = renderHook(() =>
      useDeploymentChangeEffect(
        'conv-1',
        addStatusMessage,
        isConversationLoaded,
      ),
    );

    // Conversation loads (no agent restoration needed)
    act(() => {
      isConversationLoaded = true;
    });
    rerender();

    // User switches agent
    act(() => {
      selectedItemId = 'gpt-4';
    });
    rerender();

    expect(addStatusMessage).toHaveBeenCalledTimes(1);
    const msg = addStatusMessage.mock.calls[0][0];
    expect(msg.deploymentId).toBe('gpt-4');
  });
});
