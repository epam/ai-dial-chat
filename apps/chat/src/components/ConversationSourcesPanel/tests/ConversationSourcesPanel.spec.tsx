import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type {
  ScheduledTaskDto,
  ScheduledTaskRunDto,
} from '@epam/chat-api-client';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationSourcesPanelContainer from '../ConversationSourcesPanel';

const mockDownloadAttachment = vi.fn();
const mockHandleAttachmentClick = vi.fn();
const mockHandleClose = vi.fn();
const mockRetryTask = vi.fn();
const mockLoadMore = vi.fn();
const mockRefetch = vi.fn();

let mockUploaded: DisplayAttachment[] = [];
let mockGenerated: DisplayAttachment[] = [];

const activeScheduledTaskMock = vi.hoisted(() => ({
  status: 'not-a-task-conversation' as
    | 'resolving'
    | 'not-a-task-conversation'
    | 'task-conversation',
  scheduleId: undefined as string | undefined,
  runId: undefined as string | undefined,
  conversationUpdatedAt: undefined as number | undefined,
  conversationTitle: undefined as string | undefined,
  taskState: 'idle' as 'idle' | 'loading' | 'error' | 'unavailable' | 'success',
  task: null as ScheduledTaskDto | null,
  taskError: null as Error | null,
  historyItems: [] as ScheduledTaskRunDto[],
  historyIsLoading: false,
  historyIsLoadingMore: false,
  historyError: null as Error | null,
  historyHasMore: false,
}));

vi.mock('@epam/ai-dial-source-panel', () => ({
  ConversationSourcesPanel: ({
    onDownloadAll,
    title,
    additionalSections,
  }: {
    onDownloadAll?: () => void;
    title?: ReactNode;
    additionalSections?: ReactNode;
  }) => (
    <div>
      {title && <h1>{title}</h1>}
      {additionalSections}
      <button
        type="button"
        aria-label="Download all"
        disabled={!onDownloadAll}
        onClick={onDownloadAll}
      />
    </div>
  ),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({
    handleClose: mockHandleClose,
    isOpen: true,
    messages: [],
  }),
}));

vi.mock('../../../context/ActiveScheduledTaskContext', () => ({
  useActiveScheduledTask: () => ({
    status: activeScheduledTaskMock.status,
    scheduleId: activeScheduledTaskMock.scheduleId,
    runId: activeScheduledTaskMock.runId,
    conversationUpdatedAt: activeScheduledTaskMock.conversationUpdatedAt,
    conversationTitle: activeScheduledTaskMock.conversationTitle,
    taskState: activeScheduledTaskMock.taskState,
    task: activeScheduledTaskMock.task,
    taskError: activeScheduledTaskMock.taskError,
    retryTask: mockRetryTask,
    history: {
      items: activeScheduledTaskMock.historyItems,
      isLoading: activeScheduledTaskMock.historyIsLoading,
      isLoadingMore: activeScheduledTaskMock.historyIsLoadingMore,
      error: activeScheduledTaskMock.historyError,
      hasMore: activeScheduledTaskMock.historyHasMore,
      loadMore: mockLoadMore,
      refetch: mockRefetch,
    },
  }),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [{ id: 'gpt-5', displayName: 'GPT-5' }],
  }),
}));

vi.mock(
  '../../../hooks/attachment/useAttachmentAction',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../hooks/attachment/useAttachmentAction')
      >();
    return {
      ...actual,
      downloadAttachment: (attachment: DisplayAttachment) =>
        mockDownloadAttachment(attachment),
      useAttachmentAction: () => ({
        handleAttachmentClick: mockHandleAttachmentClick,
      }),
    };
  },
);

vi.mock('../../../hooks/attachment/useOpenAttachmentCanvas', () => ({
  useOpenAttachmentCanvas: () => ({
    openAttachmentCanvas: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../hooks/conversation-sources/useConversationSources', () => ({
  useConversationSources: () => ({
    uploaded: mockUploaded,
    generated: mockGenerated,
    sources: [],
  }),
}));

vi.mock('../../../hooks/use-viewport-width', () => ({
  default: () => 1200,
}));

vi.mock('../../../hooks/useLocalStorage', () => ({
  default: () => [360, vi.fn()],
}));

vi.mock('../../../utils/dial-file', () => ({
  isDialFileId: (url: string) => url.startsWith('files/'),
}));

const makeAttachment = (
  name: string,
  overrides?: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: name,
  name,
  contentType: 'application/pdf',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

const resetActiveScheduledTaskMock = () => {
  activeScheduledTaskMock.status = 'not-a-task-conversation';
  activeScheduledTaskMock.scheduleId = undefined;
  activeScheduledTaskMock.runId = undefined;
  activeScheduledTaskMock.conversationUpdatedAt = undefined;
  activeScheduledTaskMock.conversationTitle = undefined;
  activeScheduledTaskMock.taskState = 'idle';
  activeScheduledTaskMock.task = null;
  activeScheduledTaskMock.taskError = null;
  activeScheduledTaskMock.historyItems = [];
  activeScheduledTaskMock.historyIsLoading = false;
  activeScheduledTaskMock.historyIsLoadingMore = false;
  activeScheduledTaskMock.historyError = null;
  activeScheduledTaskMock.historyHasMore = false;
};

describe('ConversationSourcesPanelContainer — download all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUploaded = [];
    mockGenerated = [];
    resetActiveScheduledTaskMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the download-all button disabled when there is no downloadable attachment', () => {
    mockUploaded = [
      makeAttachment('reference.pdf', { url: 'https://external.com/f.pdf' }),
    ];
    render(<ConversationSourcesPanelContainer />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('renders the download-all button enabled when a downloadable attachment is present', () => {
    mockUploaded = [
      makeAttachment('upload.pdf', { url: 'files/bucket/f.pdf' }),
    ];
    render(<ConversationSourcesPanelContainer />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});

describe('ConversationSourcesPanelContainer — scheduled-task sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploaded = [];
    mockGenerated = [];
    resetActiveScheduledTaskMock();
  });

  it('renders no History/Details sections for a non-task conversation', () => {
    render(<ConversationSourcesPanelContainer />);

    expect(screen.queryByText('scheduledTasks.detail.historyTitle')).toBeNull();
    expect(
      screen.queryByText('scheduledTasks.create.detailsSectionTitle'),
    ).toBeNull();
  });

  it('renders History and Details for a scheduled-task conversation even with no files/sources', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
      model: 'gpt-5',
      prompt: 'Do the thing',
    } as ScheduledTaskDto;

    render(<ConversationSourcesPanelContainer />);

    expect(screen.getByText('scheduledTasks.detail.historyTitle')).toBeTruthy();
    expect(
      screen.getByText('scheduledTasks.create.detailsSectionTitle'),
    ).toBeTruthy();
  });

  it('shows the task display name as the panel title once loaded', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;

    render(<ConversationSourcesPanelContainer />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Weekly digest' }),
    ).toBeTruthy();
  });

  it('falls back to the conversation title while the task is loading', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'loading';
    activeScheduledTaskMock.conversationTitle = 'Weekly AI Research Digest';

    render(<ConversationSourcesPanelContainer />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Weekly AI Research Digest',
      }),
    ).toBeTruthy();
  });

  it('History defaults expanded and Details defaults collapsed', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
      model: 'gpt-5',
      prompt: 'Do the thing',
    } as ScheduledTaskDto;
    activeScheduledTaskMock.historyItems = [
      { id: 'run-1', status: 'Success', startTime: new Date().toISOString() },
    ];

    render(<ConversationSourcesPanelContainer />);

    const historyButton = screen.getByRole('button', {
      name: 'scheduledTasks.detail.historyTitle',
    });
    const detailsButton = screen.getByRole('button', {
      name: 'scheduledTasks.create.detailsSectionTitle',
    });
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');

    const historyControlsId = historyButton.getAttribute('aria-controls');
    expect(historyControlsId).toBeTruthy();
    expect(document.getElementById(historyControlsId as string)).toBeTruthy();
  });

  it('does not render search or download-all when only task sections are present', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;

    render(<ConversationSourcesPanelContainer />);

    expect(
      (
        screen.getByRole('button', {
          name: 'Download all',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('shows the "Show more" button only while hasMore is true, wired to loadMore', async () => {
    const user = userEvent.setup();
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;
    activeScheduledTaskMock.historyItems = [
      { id: 'run-1', status: 'Success', startTime: new Date().toISOString() },
    ];
    activeScheduledTaskMock.historyHasMore = true;

    render(<ConversationSourcesPanelContainer />);

    const showMoreButton = screen.getByRole('button', {
      name: 'buttons.showMore',
    });
    await user.click(showMoreButton);
    expect(mockLoadMore).toHaveBeenCalledOnce();
  });

  it('hides the "Show more" button once hasMore is false', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;
    activeScheduledTaskMock.historyItems = [
      { id: 'run-1', status: 'Success', startTime: new Date().toISOString() },
    ];
    activeScheduledTaskMock.historyHasMore = false;

    render(<ConversationSourcesPanelContainer />);

    expect(
      screen.queryByRole('button', {
        name: 'buttons.showMore',
      }),
    ).toBeNull();
  });

  it('shows a retryable unavailable message in Details when the task fails to load', async () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'error';

    render(<ConversationSourcesPanelContainer />);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.create.detailsSectionTitle',
      }),
    );

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('a run-history error does not hide the Details section', async () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
      model: 'gpt-5',
      prompt: 'Do the thing',
    } as ScheduledTaskDto;
    activeScheduledTaskMock.historyError = new Error('run-history failed');

    render(<ConversationSourcesPanelContainer />);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.create.detailsSectionTitle',
      }),
    );

    expect(screen.getByText('Do the thing')).toBeTruthy();
  });

  it('a task-detail error does not hide the History section', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'error';
    activeScheduledTaskMock.historyItems = [
      { id: 'run-1', status: 'Success', startTime: new Date().toISOString() },
    ];

    render(<ConversationSourcesPanelContainer />);

    expect(
      screen.getByRole('button', {
        name: 'scheduledTasks.detail.historyTitle',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('listitem')).toBeTruthy();
  });

  it("retrying History's error does not affect Details (scoped retry)", async () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
      model: 'gpt-5',
      prompt: 'Do the thing',
    } as ScheduledTaskDto;
    activeScheduledTaskMock.historyError = new Error('run-history failed');

    render(<ConversationSourcesPanelContainer />);
    const historyRetryButtons = screen.getAllByRole('button', {
      name: 'scheduledTasks.list.retryLabel',
    });
    await userEvent.click(historyRetryButtons[0]);

    expect(mockRefetch).toHaveBeenCalledOnce();
    expect(mockRetryTask).not.toHaveBeenCalled();
  });

  it('renders History before Details, both ahead of the existing file/source content', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;
    mockUploaded = [makeAttachment('upload.pdf')];

    render(<ConversationSourcesPanelContainer />);

    const headingTexts = screen
      .getAllByRole('button')
      .map((btn) => btn.textContent ?? '');
    const historyIndex = headingTexts.findIndex((text) =>
      text.includes('scheduledTasks.detail.historyTitle'),
    );
    const detailsIndex = headingTexts.findIndex((text) =>
      text.includes('scheduledTasks.create.detailsSectionTitle'),
    );
    expect(historyIndex).toBeGreaterThanOrEqual(0);
    expect(detailsIndex).toBeGreaterThan(historyIndex);
  });

  it('resets History to expanded and Details to collapsed when scheduleId changes', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
    } as ScheduledTaskDto;

    const { rerender } = render(<ConversationSourcesPanelContainer />);

    activeScheduledTaskMock.scheduleId = 'schedule-2';
    activeScheduledTaskMock.task = {
      id: 'schedule-2',
      displayName: 'Other task',
    } as ScheduledTaskDto;
    rerender(<ConversationSourcesPanelContainer />);

    const historyButton = screen.getByRole('button', {
      name: 'scheduledTasks.detail.historyTitle',
    });
    const detailsButton = screen.getByRole('button', {
      name: 'scheduledTasks.create.detailsSectionTitle',
    });
    expect(historyButton.getAttribute('aria-expanded')).toBe('true');
    expect(detailsButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('collapsed Details content is not reachable by keyboard (no focusable descendants)', () => {
    activeScheduledTaskMock.status = 'task-conversation';
    activeScheduledTaskMock.scheduleId = 'schedule-1';
    activeScheduledTaskMock.runId = 'run-1';
    activeScheduledTaskMock.taskState = 'success';
    activeScheduledTaskMock.task = {
      id: 'schedule-1',
      displayName: 'Weekly digest',
      model: 'gpt-5',
      prompt: 'Do the thing',
    } as ScheduledTaskDto;

    render(<ConversationSourcesPanelContainer />);

    expect(screen.queryByText('Do the thing')).toBeNull();
  });
});
