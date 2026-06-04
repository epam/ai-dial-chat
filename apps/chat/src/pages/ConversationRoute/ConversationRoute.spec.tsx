import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as DeploymentsContextModule from '../../context/DeploymentsContext';
import * as conversationsApi from '../../server-api/conversations.api';
import ConversationRoute from './ConversationRoute';

vi.mock('../../context/DeploymentsContext');
vi.mock('../../server-api/conversations.api');
vi.mock('../../components/StarterButtons/StarterButtons', () => ({
  default: ({
    starters,
    onSelect,
  }: {
    starters: Array<{
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }>;
    onSelect: (starter: {
      const: number;
      title: string;
      'dial:widgetOptions': {
        populateText: string | null;
        submit: boolean;
        confirmationMessage: string | null;
      };
    }) => void;
  }) => (
    <div>
      {starters.map((starter) => (
        <button
          key={starter.const}
          type="button"
          onClick={() => onSelect(starter)}
        >
          {starter.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) };
});

vi.mock('@epam/ai-dial-conversation-input', () => ({
  ConversationInput: ({
    onSend,
    deployments,
    selectedDeploymentId,
    isInputDisabled,
  }: {
    onSend?: (msg: string, att: never[]) => void;
    deployments?: unknown[];
    selectedDeploymentId?: string | null;
    isInputDisabled?: boolean;
  }) => (
    <div>
      <span data-testid="catalog-items-count">
        {deployments?.length ?? 'none'}
      </span>
      <span data-testid="selected-item-id">
        {selectedDeploymentId ?? 'null'}
      </span>
      <span data-testid="is-input-disabled">
        {String(isInputDisabled ?? false)}
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
      selectedDeploymentConfiguration: null,
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
      selectedDeploymentConfiguration: null,
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

  it('passes isInputDisabled=true when dial:chatMessageInputDisabled is true', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: {
        isChatMessageInputDisabled: true,
      },
      isLoading: false,
      error: null,
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId('is-input-disabled').textContent).toBe('true');
    });
  });

  it('passes isInputDisabled=false when selectedDeploymentConfiguration is null', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId('is-input-disabled').textContent).toBe('false');
    });
  });

  it('passes isInputDisabled=false when dial:chatMessageInputDisabled is absent', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: { type: 'object' },
      isLoading: false,
      error: null,
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId('is-input-disabled').textContent).toBe('false');
    });
  });

  it('passes submit starter values as deployment configuration', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        starter: {
          oneOf: [
            {
              const: 0,
              title: 'OCR image',
              'dial:widgetOptions': {
                populateText: 'Scan this image',
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'deepseek-ocr-2',
      setSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
    });

    renderRoute();

    await act(async () => {
      screen.getByText('OCR image').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Scan this image',
        'deepseek-ocr-2',
        [],
        { starter: 0 },
      );
    });
  });

  it('keeps display text when submitted starter populateText is null', async () => {
    const selectedDeploymentConfiguration: DeploymentConfigurationSchema = {
      type: 'object',
      properties: {
        button: {
          description: 'Pick a number',
          oneOf: [
            {
              const: 2,
              title: '2',
              'dial:widgetOptions': {
                populateText: null,
                submit: true,
                confirmationMessage: null,
              },
            },
          ],
        },
      },
    };
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'form-example',
      setSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration,
      isLoading: false,
      error: null,
    });

    renderRoute();

    await act(async () => {
      screen.getByText('2').click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Pick a number',
        'form-example',
        [],
        { button: 2 },
      );
    });
  });
});
