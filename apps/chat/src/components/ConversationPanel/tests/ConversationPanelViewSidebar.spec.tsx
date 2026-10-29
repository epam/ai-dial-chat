import { type ConversationDeletionResultDto } from '@epam/ai-dial-chat-api-client';
import {
  useConversationExport,
  useConversationImport,
} from '@epam/ai-dial-chat-hooks/conversation-transfer';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { cloneElement, ReactElement, ReactNode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useConversations } from '../../../context/ConversationsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useUiFeature } from '../../../hooks/useUiFeature';
import ConversationPanelView from '../ConversationPanelView';

/* The lib list and its header are replaced by stubs that expose the props the
   view hands them, so the tests assert the wiring, not the lib's own rendering. */
const sectionProps = vi.hoisted(
  (): { current: Record<string, unknown> | undefined } => ({
    current: undefined,
  }),
);

/* The section's own behaviour (search, collapse, filter state) is covered in
   its lib spec; here it only records what the app wires into it. */
vi.mock('@epam/ai-dial-conversation-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-panel')>();
  return {
    ...actual,
    ConversationPanel: () => (
      <div role="region" aria-label="conversation panel" />
    ),
    ConversationListSection: (props: Record<string, unknown>) => {
      sectionProps.current = props;
      const labels = props.labels as { title: string };
      return (
        <section aria-label={labels.title}>
          <div role="group" aria-label="list header">
            {props.headerActions as ReactNode}
            {!props.isFilterHidden && (
              <button
                aria-label="choose shared"
                onClick={() =>
                  (props.onFilterChange as (tab: string) => void)('shared')
                }
              />
            )}
          </div>
          <div role="list" aria-label="conversation list">
            {(props.conversations as { id: string }[]).map((item) => (
              <button
                key={item.id}
                role="listitem"
                onClick={() =>
                  (props.onSelectConversation as (id: string) => void)(item.id)
                }
              >
                {item.id}
              </button>
            ))}
          </div>
        </section>
      );
    },
  };
});

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    ConfirmationPopup: ({
      open,
      header,
      confirmLabel,
      cancelLabel,
      description,
      onConfirm,
      onCancel,
      onClose,
      isLoading,
      disableConfirmButton,
    }: {
      open: boolean;
      header: string;
      confirmLabel: string;
      cancelLabel: string;
      description?: ReactNode;
      onConfirm: () => void;
      onCancel?: () => void;
      onClose?: () => void;
      isLoading?: boolean;
      disableConfirmButton?: boolean;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog">
          <h2>{header}</h2>
          <div>{description}</div>
          <button
            disabled={!!disableConfirmButton || !!isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel ?? onClose}>{cancelLabel}</button>
        </div>
      );
    },
    Dropdown: ({
      children,
      items,
    }: {
      children: ReactElement<{ onClick?: () => void }>;
      items: Array<{
        key: string;
        label: ReactNode;
        onClick: () => void;
      }>;
    }) => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          {cloneElement(children, {
            onClick: () => setIsOpen((value) => !value),
          })}
          {isOpen &&
            items.map((item) => (
              <button key={item.key} onClick={item.onClick}>
                {item.label}
              </button>
            ))}
        </div>
      );
    },
    ErrorMessageNotification: ({
      message,
      onClose,
      closable,
    }: {
      message: string;
      onClose?: () => void;
      closable?: boolean;
    }) => (
      <div role="alert">
        {message}
        {closable && <button onClick={onClose}>Close notification</button>}
      </div>
    ),
    Popup: ({
      open,
      header,
      children,
      onClose,
      footer,
      mainButtons,
    }: {
      open: boolean;
      header?: ReactNode;
      children?: ReactNode;
      onClose?: () => void;
      footer?: ReactNode;
      mainButtons?: Array<{
        label: ReactNode;
        disabled?: boolean;
        onClick?: () => void;
      }>;
    }) => {
      if (!open) return null;
      return (
        <div
          role="dialog"
          aria-label={typeof header === 'string' ? header : undefined}
        >
          {header && <h2>{header}</h2>}
          <button aria-label="Close popup" onClick={onClose} />
          {children}
          {footer}
          {mainButtons?.map((button, index) => (
            <button
              key={index}
              disabled={button.disabled}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
      );
    },
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconClockHour3: () => null,
  IconCopy: () => null,
  IconDotsVertical: () => null,
  IconDownload: () => null,
  IconFileArrowLeft: () => null,
  IconFileArrowRight: () => null,
  IconMessageCircle: () => null,
  IconPencilMinus: () => null,
  IconPin: () => null,
  IconPinnedFilled: () => null,
  IconShare: () => null,
  IconTrashX: () => null,
  IconUserOff: () => null,
  IconWorldShare: () => null,
  IconWorldOff: () => null,
  IconAlertCircleFilled: () => null,
  IconAlertTriangleFilled: () => null,
  IconCheck: () => null,
  IconFile: () => null,
  IconFileZip: () => null,
  IconJson: () => null,
  IconChevronDown: () => null,
  IconChevronRight: () => null,
  IconChevronUp: () => null,
  IconCircleCheckFilled: () => null,
  IconRefresh: () => null,
  IconSparkles: () => null,
  IconX: () => null,
}));

vi.mock('react-i18next', async () => {
  const { default: en } = await import('../../../i18n/locales/en.json');
  const { createInstance } = await import('i18next');
  const warningI18n = createInstance();
  await warningI18n.init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  const translatedKeys = new Set([
    'conversationPanel.rename.renameTitle',
    'conversationPanel.rename.renameInputPlaceholder',
    'conversationPanel.rename.renameWithAiLabel',
    'conversationPanel.rename.renameWithAiError',
    'conversationPanel.rename.renameTitleTooLong',
    'conversationExport.queueTitle',
    'conversationExport.cancelJobAriaLabel',
    'conversationExport.jobProgressAriaLabel',
    'conversationExport.canceledLabel',
    'conversationExport.errorFileTooLarge',
    'conversationExport.errorUnknown',
    'conversationExport.collapseQueueAriaLabel',
    'conversationExport.expandQueueAriaLabel',
    'conversationExport.closeQueueAriaLabel',
    'conversationImport.queueTitle',
    'conversationImport.cancelJobAriaLabel',
    'conversationImport.jobProgressAriaLabel',
    'conversationImport.errorUnknown',
  ]);

  const resolveTranslation = (key: string): string | undefined => {
    const value = key.split('.').reduce<unknown>((current, segment) => {
      if (typeof current !== 'object' || current === null) return undefined;
      return (current as Record<string, unknown>)[segment];
    }, en);

    return typeof value === 'string' ? value : undefined;
  };

  /* One stable `t`, like react-i18next's own, so memos keyed on it hold. */
  const t = (
    key: string,
    params?: {
      title?: string;
      fileName?: string;
      count?: number;
      names?: string;
    },
  ) => {
    if (
      key === 'conversationImport.warningAttachmentSkipped' ||
      key === 'conversationImport.jobWarningAttachmentSkipped' ||
      key === 'conversationImport.nameListWithRest'
    ) {
      return warningI18n.t(key, params);
    }
    if (!translatedKeys.has(key)) return key;

    const { count } = params ?? {};
    const plural =
      count === undefined
        ? undefined
        : resolveTranslation(`${key}_${count === 1 ? 'one' : 'other'}`);

    return (plural ?? resolveTranslation(key) ?? key)
      .replace('{{title}}', params?.title ?? '')
      .replace('{{fileName}}', params?.fileName ?? '')
      .replace('{{count}}', String(count ?? ''));
  };
  const translation = { t, i18n: { language: 'en' } };

  return {
    useTranslation: () => translation,
    /* Mirrors the suite-wide mock: the key itself, no markup. */
    Trans: ({ i18nKey }: { i18nKey?: string }) => i18nKey ?? null,
  };
});

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../server-api/share.api');
vi.mock('../../../server-api/conversation-publish.api', () => ({
  getConversationPublishHistory: vi.fn().mockResolvedValue([]),
  unpublishConversation: vi.fn().mockResolvedValue({
    path: 'conversations/bucket-123/conv1',
    folderPath: 'Organization/Shared chats',
    requestedAt: '2026-08-13T10:00:00.000Z',
    requestedBy: 'Test User',
  }),
}));
const getShareRecipientsCount = vi.hoisted(() => vi.fn());
vi.mock('../../../server-api/api-client', () => ({
  shareApi: { getShareRecipientsCount },
  conversationsApi: {},
  filesApi: {},
}));
/* A stable value, like the provider's state-backed `items`. */
const deploymentsValue = vi.hoisted(() => ({
  items: [] as { id: string; isHidden?: boolean }[],
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => deploymentsValue,
}));
const mockUseIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: mockUseIsMobile,
}));
vi.mock('../../../hooks/useUiFeature');
vi.mock('../../../constants/routes', () => ({
  getConversationRoute: (id: string) => `/conversations/${id}`,
  normalizeConversationId: (id: string) => id,
}));
vi.mock('../../../utils/icon-path', () => ({
  resolveCatalogIconUrl: (url: string) => url,
}));

vi.mock(
  '../../PublishConversationPanelContainer/PublishConversationPanelContainer',
  () => ({
    default: ({
      conversationPath,
      conversationTitle,
      onClose,
      returnFocusRef,
    }: {
      conversationPath: string;
      conversationTitle: string;
      onClose: () => void;
      returnFocusRef?: { current: HTMLElement | null };
    }) => (
      <div role="dialog" aria-label="publish conversation">
        <span>{conversationPath}</span>
        <span>{conversationTitle}</span>
        <span>{returnFocusRef?.current?.getAttribute('aria-label')}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  }),
);
vi.mock(
  '@epam/ai-dial-chat-hooks/conversation-transfer',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@epam/ai-dial-chat-hooks/conversation-transfer')
      >();
    return {
      ...actual,
      useConversationExport: vi.fn(),
      useConversationImport: vi.fn(),
    };
  },
);
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'bucket' } }),
}));
vi.mock('../get-conversation-source', () => ({
  getConversationSource: () => undefined,
}));
vi.mock(
  '../../ShareConversationPopoverContainer/ShareConversationPopoverContainer',
  () => ({
    default: ({
      conversationPath,
      onClose,
    }: {
      conversationPath: string;
      onClose: () => void;
    }) => (
      <div aria-label="share conversation">
        <span>{conversationPath}</span>
        <button onClick={onClose}>Close share</button>
      </div>
    ),
  }),
);

const mockNavigate = vi.fn();

const PANEL_ACTIONS_LABEL = 'conversationPanel.panelActionsLabel';

const mockDeleteAllConversations =
  vi.fn<() => Promise<ConversationDeletionResultDto>>();
const mockShowNotification = vi.fn();
const mockCancelJob = vi.fn();
const mockCancelImportJob = vi.fn();
const mockExportSingle = vi.fn().mockResolvedValue(undefined);
const mockExportAll = vi.fn().mockResolvedValue(undefined);
const mockDismissJob = vi.fn();
const mockRetryJob = vi.fn();
const mockImportConversations = vi.fn().mockResolvedValue(undefined);
const mockDismissImportJob = vi.fn();
const mockRetryImportJob = vi.fn();
const mockGenerateConversationTitle = vi.fn().mockResolvedValue('AI title');

/* The import file input is `aria-hidden` and `sr-only` by design (it is only
   ever triggered programmatically via the Import button), so it has no
   accessible role, label, or text a Testing Library query could target. */
const getImportFileInput = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.querySelector('input[type="file"]') as HTMLInputElement;

const baseContextValue = {
  conversations: [
    {
      id: 'conv1',
      title: 'Chat 1',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
    },
  ],
  isLoading: false,
  error: null,
  pinConversation: vi.fn(),
  markConversationViewed: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  generateConversationTitle: mockGenerateConversationTitle,
  duplicateConversation: vi.fn(),
  refreshConversations: vi.fn(),
  setVisibleConversationIds: vi.fn(),
  deleteAllConversations: mockDeleteAllConversations,
};

const defaultProps = {
  activeConversationId: 'conv1',
  onSelectConversation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseIsMobile.mockReturnValue(false);
  vi.mocked(useUiFeature).mockImplementation(
    (feature) =>
      feature !== OverlayFeature.HideConversationExport &&
      feature !== OverlayFeature.HideConversationImport,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useConversations).mockReturnValue(baseContextValue as any);
  vi.mocked(useNotification).mockReturnValue(
    createNotificationContextValue(mockShowNotification),
  );
  vi.mocked(useConversationExport).mockReturnValue({
    jobs: [],
    exportSingle: mockExportSingle,
    exportAll: mockExportAll,
    cancelJob: mockCancelJob,
    dismissJob: mockDismissJob,
    retryJob: mockRetryJob,
    dismissAll: vi.fn(),
  });
  vi.mocked(useConversationImport).mockReturnValue({
    jobs: [],
    importConversations: mockImportConversations,
    cancelJob: mockCancelImportJob,
    dismissJob: mockDismissImportJob,
    retryJob: mockRetryImportJob,
    dismissAll: vi.fn(),
  });
});

/** Every feature on except the given ones, which model the `Hide*` opt-outs. */
const enableAllExcept = (...disabled: OverlayFeature[]) =>
  vi
    .mocked(useUiFeature)
    .mockImplementation((feature) => !disabled.includes(feature));

const renderSidebar = (props = {}) =>
  render(<ConversationPanelView {...defaultProps} {...props} />);

describe('ConversationPanelView', () => {
  it('renders the section instead of the full panel', () => {
    renderSidebar();

    expect(
      screen.getByRole('region', { name: 'conversationPanel.chatsAndTasks' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('region', { name: 'conversation panel' }),
    ).toBeNull();
  });

  it('anchors the celebration history on the list', () => {
    renderSidebar();

    expect(sectionProps.current?.listClassName).toContain(
      'celebration-history',
    );
  });

  it('marks the active conversation and selects through the list', () => {
    const onSelectConversation = vi.fn();
    renderSidebar({ onSelectConversation });

    fireEvent.click(screen.getByRole('listitem'));

    expect(sectionProps.current?.activeConversationId).toBe('conv1');
    expect(onSelectConversation).toHaveBeenCalledOnce();
  });

  it('reports the chosen filter to the app', () => {
    enableAllExcept(
      OverlayFeature.HideConversationExport,
      OverlayFeature.HideConversationImport,
      OverlayFeature.HideConversationsFilter,
    );
    const onActiveFilterChange = vi.fn();
    const onRequestedFilterChange = vi.fn();
    renderSidebar({ onActiveFilterChange, onRequestedFilterChange });

    fireEvent.click(screen.getByRole('button', { name: 'choose shared' }));

    expect(onActiveFilterChange).toHaveBeenCalledWith('shared');
    expect(onRequestedFilterChange).toHaveBeenCalled();
  });

  it('offers the type filter only while scheduled tasks are enabled', () => {
    vi.mocked(useFeatureFlag).mockImplementation(
      (key?: string) => key === 'scheduledTasksEnabled',
    );
    const { unmount } = renderSidebar();
    expect(sectionProps.current?.isTypeFilterHidden).toBe(false);
    unmount();

    vi.mocked(useFeatureFlag).mockReturnValue(false);
    renderSidebar();

    expect(sectionProps.current?.isTypeFilterHidden).toBe(true);
  });

  it('hands a filter requested by the app to the section', () => {
    renderSidebar({ requestedFilter: 'my-chats' });

    expect(sectionProps.current?.requestedFilter).toBe('my-chats');
  });

  it('hides the filter under hide-conversations-filter', () => {
    /* The default posture of this file's mock turns every other key on,
       `hide-conversations-filter` included. */
    enableAllExcept(
      OverlayFeature.HideConversationExport,
      OverlayFeature.HideConversationImport,
    );
    renderSidebar();

    expect(sectionProps.current?.isFilterHidden).toBe(true);
    expect(screen.queryByRole('button', { name: 'choose shared' })).toBeNull();
  });

  it('renders the panel overflow menu in the header actions slot', () => {
    renderSidebar();

    expect(
      within(screen.getByRole('group', { name: 'list header' })).getByRole(
        'button',
        { name: PANEL_ACTIONS_LABEL },
      ),
    ).toBeTruthy();
  });

  it('renders no section when the conversations section is off', () => {
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsSection,
    );
    renderSidebar();

    expect(screen.queryByRole('group', { name: 'list header' })).toBeNull();
    expect(
      screen.queryByRole('list', { name: 'conversation list' }),
    ).toBeNull();
  });

  it('portals the import input out of the sidebar', () => {
    /* The input is sr-only and has no role, so where it is mounted can only
       be checked against the render container. */
    /* eslint-disable testing-library/no-container */
    const { container } = renderSidebar();

    expect(getImportFileInput()).not.toBeNull();
    expect(container.contains(getImportFileInput())).toBe(false);
    /* eslint-enable testing-library/no-container */
  });
});
