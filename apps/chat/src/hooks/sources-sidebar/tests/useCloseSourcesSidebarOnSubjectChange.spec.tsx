import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloseSourcesSidebarOnSubjectChange } from '../useCloseSourcesSidebarOnSubjectChange';

const {
  mockRouteConversationId,
  mockScheduleId,
  mockHistoryItems,
  mockHandleClose,
} = vi.hoisted(() => ({
  mockRouteConversationId: { value: null as string | null },
  mockScheduleId: { value: undefined as string | undefined },
  mockHistoryItems: { value: [] as ScheduledTaskRunDto[] },
  mockHandleClose: vi.fn(),
}));

vi.mock('../../../context/ActiveScheduledTaskContext', () => ({
  useActiveScheduledTask: () => ({
    routeConversationId: mockRouteConversationId.value,
    scheduleId: mockScheduleId.value,
    history: { items: mockHistoryItems.value },
  }),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({
    handleClose: mockHandleClose,
    isOpen: true,
  }),
}));

/* Sets the mocked route/schedule state and re-renders the hook, as a navigation would. */
const rerenderWith = (
  rerender: (props?: undefined) => void,
  conversationId: string | null,
  scheduleId?: string,
) => {
  mockRouteConversationId.value = conversationId;
  mockScheduleId.value = scheduleId;
  rerender();
};

/* One run of `scheduleId`'s loaded history, as the run-history query returns it. */
const makeHistoryRun = (
  scheduleId: string,
  runId: string,
): ScheduledTaskRunDto => ({
  id: runId,
  status: 'Success',
  startTime: '2026-07-24T09:00:00.000Z',
  conversationId: `conversations/bucket/.scheduler/${scheduleId}/${runId}`,
});

describe('useCloseSourcesSidebarOnSubjectChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteConversationId.value = null;
    mockScheduleId.value = undefined;
    mockHistoryItems.value = [];
  });

  it('does not close on initial mount', () => {
    renderHook(() => useCloseSourcesSidebarOnSubjectChange());

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('keeps the sidebar open when switching between runs of the same task', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-2',
      'schedule-1',
    );

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('keeps the sidebar open when switching to a run the history knows but the conversation list does not', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    /*
     * The run history loads — including a freshly fired run the `nextRunTime`
     * background refresh picked up — while the conversation list does not, so
     * that run will resolve to no scheduleId.
     */
    mockHistoryItems.value = [
      makeHistoryRun('schedule-1', 'run-2'),
      makeHistoryRun('schedule-1', 'run-1'),
    ];
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-2',
      undefined,
    );

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('keeps the sidebar open on a same-task switch right after a scheduleId blip', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHistoryItems.value = [
      makeHistoryRun('schedule-1', 'run-2'),
      makeHistoryRun('schedule-1', 'run-1'),
    ];
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    /* A conversation-list reload transiently drops the resolved scheduleId. */
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      undefined,
    );
    expect(mockHandleClose).not.toHaveBeenCalled();
    mockHandleClose.mockClear();

    /* Then the switch to another run of the same task re-resolves the
       scheduleId only on the new conversation. */
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-2',
      'schedule-1',
    );

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('keeps the sidebar open on a same-task switch after a blip even when no history loaded', () => {
    /* The previous run never reached the run history, so only the kept
       scheduleId can carry the subject across the blip. */
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      undefined,
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-2',
      'schedule-1',
    );

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('closes the sidebar when switching to another task run absent from the conversation list', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHistoryItems.value = [
      makeHistoryRun('schedule-1', 'run-2'),
      makeHistoryRun('schedule-1', 'run-1'),
    ];
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-2/run-1',
      undefined,
    );

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('closes the sidebar when switching to a different task', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-2/run-1',
      'schedule-2',
    );

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('closes the sidebar when switching from a task conversation to a normal conversation', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(rerender, 'conversations/bucket/plain-chat', undefined);

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('closes the sidebar when switching between normal conversations', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(rerender, 'conversations/bucket/plain-chat-1', undefined);
    mockHandleClose.mockClear();

    rerenderWith(rerender, 'conversations/bucket/plain-chat-2', undefined);

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('closes the sidebar when switching from a normal conversation to a task conversation', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(rerender, 'conversations/bucket/plain-chat', undefined);
    mockHandleClose.mockClear();

    /* The subject changes from none to a task, so the sidebar resets. */
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('closes the sidebar when the new conversation resolves to no scheduleId yet', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-9',
      undefined,
    );

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('does not close when the conversation id is unchanged and the scheduleId flickers to undefined', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    /* A conversation-list reload transiently drops the resolved scheduleId. */
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      undefined,
    );

    expect(mockHandleClose).not.toHaveBeenCalled();
  });

  it('closes the sidebar when the route resolves to no conversation id', () => {
    const { rerender } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );
    rerenderWith(
      rerender,
      'conversations/bucket/.scheduler/schedule-1/run-1',
      'schedule-1',
    );
    mockHandleClose.mockClear();

    /* Bare `/conversations` or a malformed path — the panel stays mounted. */
    rerenderWith(rerender, null, undefined);

    expect(mockHandleClose).toHaveBeenCalledOnce();
  });

  it('does nothing on unmount — leaving the conversations routes is the Conversation page cleanup', () => {
    const { unmount } = renderHook(() =>
      useCloseSourcesSidebarOnSubjectChange(),
    );

    /*
     * Leaving `/conversations/*` unmounts the panel, so this hook never runs
     * its effect for the exit; the Conversation page's unmount cleanup owns
     * that close (covered in Conversation.spec.tsx).
     */
    unmount();

    expect(mockHandleClose).not.toHaveBeenCalled();
  });
});
