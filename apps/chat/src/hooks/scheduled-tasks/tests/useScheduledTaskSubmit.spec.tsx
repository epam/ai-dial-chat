import { ScheduledTaskErrorCode } from '@epam/ai-dial-chat-api-client';
import type { ScheduledTaskCreateFormErrors } from '@epam/ai-dial-scheduled-tasks';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../../constants/translation-keys';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useScheduledTaskSubmit } from '../useScheduledTaskSubmit';

const showNotificationMock = vi.fn();
const dismissNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () =>
    createNotificationContextValue(showNotificationMock, {
      dismissNotification: dismissNotificationMock,
    }),
}));

const getApiErrorDetailsMock = vi.fn();
const checkScheduledTaskAuthSessionErrorMock = vi.fn();
/*
 * Partial mock: the submit hook reads the real `OfflineCredentialsLoginOutcomeType`
 * enum at runtime, so the actual module stays available and only the helpers
 * it stubs are overridden.
 */
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    getApiErrorDetails: (...args: unknown[]) => getApiErrorDetailsMock(...args),
    checkScheduledTaskAuthSessionError: (...args: unknown[]) =>
      checkScheduledTaskAuthSessionErrorMock(...args),
  };
});

/* Returns the passed error key, so generic-toast assertions read the key directly. */
const resolveScheduledTaskErrorMessageMock = vi.fn();
vi.mock('../../../utils/map-scheduled-task-dto', () => ({
  resolveScheduledTaskErrorMessage: (...args: unknown[]) =>
    resolveScheduledTaskErrorMessageMock(...args),
}));

const mapScheduledTaskApiErrorMock = vi.fn();
vi.mock('../../../utils/scheduled-task-form-validation', () => ({
  mapScheduledTaskApiError: (...args: unknown[]) =>
    mapScheduledTaskApiErrorMock(...args),
}));

const autoLoginMock = vi.fn();
vi.mock('../useScheduledTaskAuthAutoLogin', () => ({
  useScheduledTaskAuthAutoLogin: () => ({
    autoLogin: (...args: unknown[]) => autoLoginMock(...args),
  }),
}));

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

const prepareMock = vi.fn();
const saveMock = vi.fn();
const onSuccessMock = vi.fn();
const onFieldErrorsMock = vi.fn();
const handleExtraErrorMock = vi.fn();

/* Mounts the hook with a stable options set; each test stubs the mocks it drives. */
const Harness = () => {
  const { isSubmitting, handleSubmit } = useScheduledTaskSubmit({
    prepare: prepareMock,
    save: saveMock,
    onSuccess: onSuccessMock,
    onFieldErrors: onFieldErrorsMock,
    errorKey: ScheduledTasksI18nKeys.CreateErrorNotification,
    handleExtraError: handleExtraErrorMock,
    /* The pages render the kit Button; the harness renders a plain one —
       both land in the toast's action slot with the same accessible name. */
    renderLoginAndRetryAction: (onAction) => (
      <button type="button" onClick={onAction}>
        scheduledTasks.loginAndRetryAction
      </button>
    ),
  });
  return (
    <>
      <button type="button" onClick={() => void handleSubmit()}>
        save
      </button>
      <output aria-label="submitting">{String(isSubmitting)}</output>
    </>
  );
};

/*
 * The login-required toast itself is not rendered by this harness (the
 * notification context is mocked), so its action element mounts on its own
 * for the click — the latest shown notification carries the live one.
 */
const clickLoginAndRetryAction = async () => {
  const lastCall = showNotificationMock.mock.calls.at(-1);
  if (lastCall == null) {
    throw new Error('no notification shown yet');
  }
  const { action } = lastCall[0] as { action: ReactElement };
  const { unmount } = render(action);
  try {
    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.loginAndRetryAction',
      }),
    );
  } finally {
    unmount();
  }
};

describe('useScheduledTaskSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareMock.mockReturnValue({ displayName: 'Daily summary' });
    getApiErrorDetailsMock.mockResolvedValue({
      message: null,
      traceId: 'trace-403',
    });
    mapScheduledTaskApiErrorMock.mockReturnValue(undefined);
    handleExtraErrorMock.mockReturnValue(false);
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: false,
    });
    resolveScheduledTaskErrorMessageMock.mockImplementation(
      (_details: unknown, key: unknown) => String(key),
    );
  });

  it('submits the prepared body and runs the success path once', async () => {
    saveMock.mockResolvedValue(undefined);
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onSuccessMock).toHaveBeenCalledOnce());
    expect(prepareMock).toHaveBeenCalledOnce();
    expect(saveMock).toHaveBeenCalledWith({ displayName: 'Daily summary' });
    expect(showNotificationMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('submitting').textContent).toBe('false');
  });

  it('freezes on isSubmitting while the save is in flight', async () => {
    let resolveSave: (() => void) | undefined;
    saveMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(screen.getByLabelText('submitting').textContent).toBe('true');
    resolveSave?.();
    await waitFor(() =>
      expect(screen.getByLabelText('submitting').textContent).toBe('false'),
    );
  });

  it('does not save when preparation fails', async () => {
    prepareMock.mockReturnValue(null);
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(saveMock).not.toHaveBeenCalled();
    expect(onSuccessMock).not.toHaveBeenCalled();
    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  it('applies mapped field errors without a toast', async () => {
    const fieldErrors: ScheduledTaskCreateFormErrors = {
      displayName: 'Name is required',
    };
    mapScheduledTaskApiErrorMock.mockReturnValue(fieldErrors);
    saveMock.mockRejectedValue(new Error('invalid'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(onFieldErrorsMock).toHaveBeenCalledOnce());
    expect(onFieldErrorsMock).toHaveBeenCalledWith(fieldErrors);
    expect(showNotificationMock).not.toHaveBeenCalled();
    expect(checkScheduledTaskAuthSessionErrorMock).not.toHaveBeenCalled();
  });

  it('stops at the page-specific error branch when it handles the error', async () => {
    handleExtraErrorMock.mockReturnValue(true);
    saveMock.mockRejectedValue(new Error('gone'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(handleExtraErrorMock).toHaveBeenCalledOnce());
    expect(showNotificationMock).not.toHaveBeenCalled();
    expect(checkScheduledTaskAuthSessionErrorMock).not.toHaveBeenCalled();
  });

  it('shows the generic toast with the trace id for a revoked admin consent', async () => {
    getApiErrorDetailsMock.mockResolvedValue({
      message: null,
      traceId: 'trace-consent',
      code: ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
        requestId: 'trace-consent',
      }),
    );
    expect(autoLoginMock).not.toHaveBeenCalled();
  });

  it('shows the login-required toast without invoking the login on an attributed 403', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    const payload = showNotificationMock.mock.calls[0][0];
    expect(payload.message).toBe('scheduledTasks.loginRequiredNotification');
    expect(payload.requestId).toBe('trace-403');
    expect(payload.action).toBeTruthy();
    /* The login waits for the user's consent — nothing is invoked automatically. */
    expect(autoLoginMock).not.toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it('shows the login-required toast without the retry action when the host supplies no action renderer', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    const NoActionRendererHarness = () => {
      const { handleSubmit } = useScheduledTaskSubmit({
        prepare: prepareMock,
        save: saveMock,
        onSuccess: onSuccessMock,
        onFieldErrors: onFieldErrorsMock,
        errorKey: ScheduledTasksI18nKeys.CreateErrorNotification,
      });
      return (
        <button type="button" onClick={() => void handleSubmit()}>
          save
        </button>
      );
    };
    render(<NoActionRendererHarness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    const payload = showNotificationMock.mock.calls[0][0];
    expect(payload.message).toBe('scheduledTasks.loginRequiredNotification');
    /* An omitted renderer explicitly opts out of the retry affordance. */
    expect(payload.action).toBeUndefined();
  });

  it('retries the re-prepared save after the toast action logs in', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    saveMock
      .mockRejectedValueOnce(new Error('forbidden'))
      .mockResolvedValueOnce(undefined);
    autoLoginMock.mockResolvedValue({ type: 'success' });
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    await clickLoginAndRetryAction();

    expect(autoLoginMock).toHaveBeenCalledWith(CONNECT);
    /* The actionable toast is dismissed once its action runs. */
    expect(dismissNotificationMock).toHaveBeenCalledOnce();
    /* The body is re-prepared for the retried attempt. */
    expect(prepareMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onSuccessMock).toHaveBeenCalledOnce());
    expect(saveMock).toHaveBeenCalledTimes(2);
  });

  it('shows the login-failed toast and keeps the form when the login fails', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    autoLoginMock.mockResolvedValue({ type: 'failure' });
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    await clickLoginAndRetryAction();

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledTimes(2));
    expect(showNotificationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.autoLoginFailedNotification',
        requestId: 'trace-403',
      }),
    );
    expect(saveMock).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('submitting').textContent).toBe('false');
  });

  it('stays silent when the login is cancelled by the user', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    autoLoginMock.mockResolvedValue({ type: 'cancelled' });
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    await clickLoginAndRetryAction();

    await waitFor(() => expect(autoLoginMock).toHaveBeenCalledOnce());
    /* A user-cancelled login is not a failure — no second toast, no retry. */
    expect(showNotificationMock).toHaveBeenCalledOnce();
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it('keeps the generic handling for a failed retried save without a second login toast', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    /* Both attempts fail with an attributed 403 — the retry must not re-offer the login. */
    saveMock.mockRejectedValue(new Error('forbidden'));
    autoLoginMock.mockResolvedValue({ type: 'success' });
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    await clickLoginAndRetryAction();

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledTimes(2));
    /* The retried failure takes the generic toast — no second login-required toast. */
    expect(showNotificationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
        requestId: 'trace-403',
      }),
    );
    expect(autoLoginMock).toHaveBeenCalledOnce();
    expect(saveMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the generic toast when a 403 is not attributed to the auth session', async () => {
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: false,
    });
    saveMock.mockRejectedValue(new Error('forbidden'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
        requestId: 'trace-403',
      }),
    );
    expect(autoLoginMock).not.toHaveBeenCalled();
  });

  it('shows the fallback toast when the error handler itself fails', async () => {
    getApiErrorDetailsMock.mockRejectedValue(new Error('parser broke'));
    saveMock.mockRejectedValue(new Error('forbidden'));
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
      }),
    );
  });
});
