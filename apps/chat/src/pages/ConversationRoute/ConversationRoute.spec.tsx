import type { DeploymentConfigurationSchema } from '@epam/ai-dial-chat-shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as UserContextModule from '../../context/auth/UserContext';
import * as DeploymentsContextModule from '../../context/DeploymentsContext';
import * as conversationsApi from '../../server-api/conversations.api';
import * as filesApi from '../../server-api/files.api';
import * as attachmentToDtoModule from '../../utils/attachment-to-dto';
import ConversationRoute from './ConversationRoute';

vi.mock('../../context/DeploymentsContext');
vi.mock('../../context/auth/UserContext');
vi.mock('../../server-api/conversations.api');
vi.mock('../../server-api/files.api');
vi.mock('../../utils/attachment-to-dto');
vi.mock('../../utils/build-upload-path', () => ({
  buildUploadPath: vi.fn(
    (attachment: { name: string }) => `uploads/${attachment.name}`,
  ),
}));
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
    onUploadAttachment,
    deployments,
    selectedDeploymentId,
    isInputDisabled,
  }: {
    onSend?: (msg: string, att: never[]) => Promise<void> | void;
    onUploadAttachment?: (attachment: {
      name: string;
      file: File;
    }) => Promise<string>;
    deployments?: unknown[];
    selectedDeploymentId?: string | null;
    isInputDisabled?: boolean;
  }) => (
    <div>
      <output aria-label="Catalog items count">
        {deployments?.length ?? 'none'}
      </output>
      <output aria-label="Selected deployment">
        {selectedDeploymentId ?? 'null'}
      </output>
      <output aria-label="Input disabled">
        {String(isInputDisabled ?? false)}
      </output>
      <button
        type="button"
        onClick={() => {
          Promise.resolve(onSend?.('Hello', [])).catch((_err: unknown) => {
            // intentional: test mock swallows rejection to avoid unhandled promise
          });
        }}
      >
        Send
      </button>
      <button
        type="button"
        onClick={() => {
          void onUploadAttachment?.({
            name: 'file.pdf',
            file: new File(['content'], 'file.pdf', {
              type: 'application/pdf',
            }),
          });
        }}
      >
        Upload
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
  const mockUseUser = vi.mocked(UserContextModule.useUser);
  const mockCreateConversation = vi.mocked(conversationsApi.createConversation);
  const mockUploadFile = vi.mocked(filesApi.uploadFile);
  const mockAttachmentsToDtos = vi.mocked(
    attachmentToDtoModule.attachmentsToDtos,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
    });
    mockUseUser.mockReturnValue({
      user: { sub: 'u1', providerId: 'p1', claims: {}, bucket: 'user-bucket' },
      status: 'authenticated',
      refresh: vi.fn(),
      reset: vi.fn(),
    });
    mockCreateConversation.mockResolvedValue({
      id: 'bucket/path__Hello',
    } as never);
    mockUploadFile.mockResolvedValue({ url: 'https://example.com/file.pdf' });
    mockAttachmentsToDtos.mockReturnValue(undefined);
  });

  it('passes catalog items and selectedItemId into ConversationInput', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Catalog items count').textContent).toBe(
        '1',
      );
      expect(screen.getByLabelText('Selected deployment').textContent).toBe(
        'gpt-4o',
      );
    });
  });

  it('calls apiCreateConversation with selectedItemId when send fires', async () => {
    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        'gpt-4o',
        undefined,
      );
    });
  });

  it('uploads attachments through onUploadAttachment before send', async () => {
    renderRoute();
    const uploadButton = await screen.findByRole('button', { name: 'Upload' });

    await act(async () => {
      uploadButton.click();
    });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(
        'user-bucket',
        'uploads/file.pdf',
        expect.any(File),
      );
    });
  });

  it('does not call apiCreateConversation when selectedItemId is null', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: null,
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: null,
      isLoading: false,
      error: null,
    });

    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it('passes isInputDisabled=true when dial:chatMessageInputDisabled is true', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: {
        isChatMessageInputDisabled: true,
      },
      isLoading: false,
      error: null,
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('true');
    });
  });

  it('passes isInputDisabled=false when selectedDeploymentConfiguration is null', async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('false');
    });
  });

  it('passes isInputDisabled=false when dial:chatMessageInputDisabled is absent', async () => {
    mockUseDeployments.mockReturnValue({
      items: mockItems,
      selectedItemId: 'gpt-4o',
      setSelectedItemId: vi.fn(),
      restoreSelectedItemId: vi.fn(),
      selectedDeploymentConfiguration: { type: 'object' },
      isLoading: false,
      error: null,
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByLabelText('Input disabled').textContent).toBe('false');
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
      restoreSelectedItemId: vi.fn(),
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
      restoreSelectedItemId: vi.fn(),
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

  it('creates a text-only conversation when bucket is empty', async () => {
    mockUseUser.mockReturnValue({
      user: { sub: 'u1', providerId: 'p1', claims: {}, bucket: '' },
      status: 'authenticated',
      refresh: vi.fn(),
      reset: vi.fn(),
    });

    renderRoute();
    const sendButton = await screen.findByRole('button', { name: 'Send' });

    await act(async () => {
      sendButton.click();
    });

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith(
        'Hello',
        'gpt-4o',
        undefined,
      );
    });
  });
});
