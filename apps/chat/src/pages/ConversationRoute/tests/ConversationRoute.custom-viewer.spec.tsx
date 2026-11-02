import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomViewerI18nKeys } from '../../../constants/translation-keys';
import * as ConversationsContextModule from '../../../context/ConversationsContext';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import * as conversationsApi from '../../../server-api/conversations.api';
import ConversationRoute from '../ConversationRoute';

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn(), key: 'nav-1' }));

vi.mock('react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useLocation: () => ({ pathname: '/', state: null, key: routerMocks.key }),
}));

/* The composer is reduced to what the gate relies on: its disabled flag and its children slot. */
vi.mock(
  '../../../components/NewConversationComposer/NewConversationComposer',
  () => ({
    default: ({
      isInputDisabled,
      children,
    }: {
      isInputDisabled?: boolean;
      children?: ReactNode;
    }) => (
      <div>
        <textarea aria-label="message" disabled={isInputDisabled} />
        {children}
      </div>
    ),
  }),
);
vi.mock('../../../components/StarterButtons/StarterButtons', () => ({
  default: () => <div>starter-buttons</div>,
}));
vi.mock('../../../components/CustomViewer/CustomViewerFrame', () => ({
  default: ({
    conversationId,
    onConversationCreated,
  }: {
    conversationId?: string;
    onConversationCreated?: (id: string) => void;
  }) => (
    <div>
      {`custom-viewer:${conversationId ?? 'none'}`}
      <button
        type="button"
        onClick={() => onConversationCreated?.('conversations/bucket/New chat')}
      >
        viewer-created
      </button>
    </div>
  ),
}));
vi.mock(
  '../../../components/DeploymentSelector/useDeploymentSelectorOverlay',
  () => ({
    useDeploymentSelectorOverlay: () => ({
      renderOverlay: vi.fn(),
      catalogModal: null,
    }),
  }),
);
vi.mock('../../../components/PromptSelector/usePromptSelectorOverlay', () => ({
  usePromptSelectorOverlay: () => ({
    renderOverlay: undefined,
    promptCatalogModal: null,
    parametersPopup: null,
    openParametersPopup: vi.fn(),
  }),
}));
vi.mock('../../../components/SkillSelector/useSkillSelectorOverlay', () => ({
  useSkillSelectorOverlay: () => ({
    skillMenuOverlay: undefined,
    commandMenu: undefined,
    skillCatalogModal: null,
    skillDetailsPanel: null,
    message: '',
    messageRevision: 0,
    activeMentions: [],
    onDraftChange: vi.fn(),
    onBackspaceAtCaret: vi.fn(),
    caretPositionOverride: undefined,
    selectedSkills: [],
    isSkillUnsupported: false,
    selectSkillByUrl: vi.fn(),
    resetSkillMentions: vi.fn(),
    seedSkillMentions: vi.fn(),
    recognizeMentionsInInsertion: vi.fn(),
  }),
}));
vi.mock(
  '../../../context/SkillsContext',
  async () => import('../../../context/tests/skills-context-mock'),
);
vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: () => true,
}));
vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/IsolatedModelViewContext', () => ({
  sanitizeIsolatedModelId: (id: string) => id,
  useIsolatedModelView: () => ({
    isActive: false,
    isNotFound: false,
    resolvedDeploymentId: null,
  }),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showErrorNotification: vi.fn() }),
}));
vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: () => undefined,
}));
vi.mock('../../../server-api/conversations.api');
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    useToolsMenu: () => ({
      toolsMenuItems: [],
      onToolToggle: vi.fn(),
      toolConfigurationValue: undefined,
    }),
  };
});

const viewerApp = {
  id: 'applications/bucket/explorer',
  displayName: 'Explorer',
  type: 'application',
  viewerUrl: 'https://viewer.example.com/',
} as DeploymentItemDto;
const model = {
  id: 'gpt-4o',
  displayName: 'GPT-4o',
  type: 'model',
} as DeploymentItemDto;

describe('ConversationRoute — Custom Viewer', () => {
  const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
  const refreshConversations = vi.fn();

  /*
   * Backed by an external store so a selection change re-renders the memoised
   * route the way the real context does.
   */
  let deploymentsValue = createDeploymentsContextValue();
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const selectDeployment = (selectedItemId: string) => {
    deploymentsValue = createDeploymentsContextValue({
      items: [viewerApp, model],
      selectedItemId,
    });
    listeners.forEach((listener) => listener());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.key = 'nav-1';
    vi.mocked(ConversationsContextModule.useConversations).mockReturnValue({
      refreshConversations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    selectDeployment(viewerApp.id);
    mockUseDeployments.mockImplementation(() =>
      useSyncExternalStore(subscribe, () => deploymentsValue),
    );
  });

  const startButton = () =>
    screen.getByRole('button', { name: CustomViewerI18nKeys.StartWorking });

  it('shows the start gate and disables the input for a viewer application', () => {
    render(<ConversationRoute />);

    expect(startButton()).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'message' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByText('starter-buttons')).toBeNull();
  });

  it('mounts the viewer without a conversation id when Start is pressed', async () => {
    render(<ConversationRoute />);

    await userEvent.click(startButton());

    expect(screen.getByText('custom-viewer:none')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'message' })).toBeNull();
    expect(conversationsApi.createConversation).not.toHaveBeenCalled();
  });

  it('drops back to the composer when another deployment is selected', async () => {
    render(<ConversationRoute />);
    await userEvent.click(startButton());

    act(() => selectDeployment(model.id));

    expect(screen.queryByText('custom-viewer:none')).toBeNull();
    expect(screen.getByText('starter-buttons')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'message' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('returns to the gate when New chat is pressed again on the same route', async () => {
    const { rerender } = render(<ConversationRoute />);
    await userEvent.click(startButton());

    routerMocks.key = 'nav-2';
    /* A fresh navigation re-renders the route through the router; a new
     * deployments snapshot stands in for that here. */
    act(() => selectDeployment(viewerApp.id));
    rerender(<ConversationRoute />);

    expect(screen.queryByText('custom-viewer:none')).toBeNull();
    expect(startButton()).toBeTruthy();
  });

  it('refreshes the list and opens a conversation the viewer created', async () => {
    render(<ConversationRoute />);
    await userEvent.click(startButton());

    await userEvent.click(
      screen.getByRole('button', { name: 'viewer-created' }),
    );

    expect(refreshConversations).toHaveBeenCalledWith([
      'conversations/bucket/New chat',
    ]);
    expect(routerMocks.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/conversations/bucket/New'),
    );
  });

  it('keeps the normal composer for a deployment without a viewer', () => {
    selectDeployment(model.id);
    render(<ConversationRoute />);

    expect(screen.getByText('starter-buttons')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: CustomViewerI18nKeys.StartWorking }),
    ).toBeNull();
  });
});
