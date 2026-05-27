import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as DeploymentsContextModule from '../../context/DeploymentsContext';
import * as conversationsApi from '../../server-api/conversations.api';
import ConversationRoute from './ConversationRoute';

vi.mock('../../context/DeploymentsContext');
vi.mock('../../server-api/conversations.api');
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) };
});

vi.mock('@epam/ai-dial-conversation-input', () => ({
  ConversationInput: ({
    onSend,
    deployments,
    selectedDeploymentId,
  }: {
    onSend?: (msg: string, att: never[]) => void;
    deployments?: unknown[];
    selectedDeploymentId?: string | null;
  }) => (
    <div>
      <span data-testid="catalog-items-count">
        {deployments?.length ?? 'none'}
      </span>
      <span data-testid="selected-item-id">
        {selectedDeploymentId ?? 'null'}
      </span>
      <button
        type="button"
        onClick={() => onSend?.('Hello', [])}
        data-testid="send-trigger"
      >
        Send
      </button>
    </div>
  ),
}));

const mockItems = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
];

const renderRoute = () =>
  render(
    <MemoryRouter>
      <ConversationRoute />
    </MemoryRouter>,
  );

describe('ConversationRoute', () => {
  const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
  const mockCreateConversation = vi.mocked(conversationsApi.createConversation);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      isLoading: false,
      error: null,
    });
    mockCreateConversation.mockResolvedValue({
      id: 'bucket/path__Hello',
    } as never);
  });

  it('passes catalog items and selectedItemId into ConversationInput', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId('catalog-items-count').textContent).toBe('1');
      expect(screen.getByTestId('selected-item-id').textContent).toBe('gpt-4o');
    });
  });

  it('calls apiCreateConversation with selectedItemId when send fires', async () => {
    renderRoute();
    await waitFor(() => screen.getByTestId('send-trigger'));

    await act(async () => {
      screen.getByTestId('send-trigger').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        'gpt-4o',
        undefined,
      );
    });
  });

  it('does not call apiCreateConversation when selectedItemId is null', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      isLoading: false,
      error: null,
    });

    renderRoute();
    await waitFor(() => screen.getByTestId('send-trigger'));

    await act(async () => {
      screen.getByTestId('send-trigger').click();
    });

    expect(mockCreateConversation).not.toHaveBeenCalled();
  });
});
