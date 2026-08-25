import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import type { TriggerSaveGeneralPayload } from '../../../types/apps-editor';
import AppsEditor from '../AppsEditor';

let latestSettingsStepProps: {
  onUpdated?: () => void;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
  isPreviewing?: boolean;
  previewResetKey?: number;
} = {};

let latestGeneralFormProps: {
  appId?: string;
  onCreated: (appId: string, displayName?: string, iconUrl?: string) => void;
} | null = null;

/* Most tests exercise Save/Preview behavior once the Settings step is ready,
 * so the mock auto-reports readiness on mount by default. Tests covering the
 * readiness-gating behavior itself flip this off before rendering. */
let shouldSettingsAutoReady = true;

const settingsStepTriggerSave =
  vi.fn<(general?: TriggerSaveGeneralPayload) => void>();
const generalFormSubmit = vi.fn();
const generalFormGetValues = vi.fn<() => TriggerSaveGeneralPayload>();

vi.mock('../SettingsStep', () => ({
  default: forwardRef(function MockSettingsStep(
    props: {
      onUpdated?: () => void;
      onSaveSuccess?: (hasChanges: boolean) => void;
      onSaveError?: (error: string) => void;
      onReadyChange?: (isReady: boolean) => void;
      onLoggedOutChange?: (isLoggedOut: boolean) => void;
      isPreviewing?: boolean;
      previewResetKey?: number;
    },
    ref,
  ) {
    latestSettingsStepProps = props;
    useImperativeHandle(ref, () => ({ triggerSave: settingsStepTriggerSave }));
    useEffect(() => {
      if (shouldSettingsAutoReady) {
        props.onReadyChange?.(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div
        data-previewing={props.isPreviewing ? 'true' : 'false'}
        data-preview-reset-key={props.previewResetKey ?? 0}
      >
        settings-step
      </div>
    );
  }),
}));

vi.mock('../GeneralForm', () => ({
  default: forwardRef(function MockGeneralForm(
    props: {
      appId?: string;
      onCreated: (
        appId: string,
        displayName?: string,
        iconUrl?: string,
      ) => void;
    },
    ref,
  ) {
    latestGeneralFormProps = props;
    useImperativeHandle(ref, () => ({
      submit: generalFormSubmit,
      getValues: generalFormGetValues,
    }));
    return <div>general-form</div>;
  }),
}));

vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/NotificationContext');

const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
const refetchDeployments = vi.fn();
const mockShowNotification = vi.fn();

const SCHEMA = {
  id: 'quickapps2-schema',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};

const renderEditor = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/apps-editor?${search}`]}>
      <AppsEditor />
    </MemoryRouter>,
  );

describe('AppsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchDeployments.mockReset();
    refetchDeployments.mockResolvedValue(undefined);
    latestSettingsStepProps = {};
    latestGeneralFormProps = null;
    shouldSettingsAutoReady = true;
    generalFormGetValues.mockReset().mockReturnValue({ name: 'My App' });
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    mockUseDeployments.mockReturnValue({
      schemas: [SCHEMA],
      items: [],
      refetchDeployments,
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show the preview button on the General step', () => {
    renderEditor('step=general&schema=quickapps2-schema');

    expect(
      screen.queryByRole('button', { name: BasicI18nKeys.Preview }),
    ).not.toBeTruthy();
  });

  it('shows the preview button on the Settings step with a saved app id', () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    expect(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    ).toBeTruthy();
  });

  it('enters preview mode when the preview save succeeds', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.(false);
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('true');
  });

  it('enters preview mode immediately without waiting for the deployments refetch', async () => {
    let resolveRefetch: () => void = () => undefined;
    const refetchPromise = new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    });
    refetchDeployments.mockReturnValueOnce(refetchPromise);
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.(false);
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('true');
    expect(
      screen.queryByLabelText(AppsEditorI18nKeys.SavingOverlayLabel),
    ).toBeNull();

    // The still-unresolved refetch must not cause any later error or state change.
    await act(async () => {
      resolveRefetch();
      await refetchPromise;
    });
  });

  it('does not block or error preview entry when the deployments refetch rejects', async () => {
    refetchDeployments.mockImplementationOnce(() =>
      Promise.reject(new Error('boom')),
    );
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    await act(async () => {
      latestSettingsStepProps.onSaveSuccess?.(false);
      await Promise.resolve();
    });

    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(AppsEditorI18nKeys.SavingOverlayLabel),
    ).toBeNull();
  });

  it('refetches deployments when settings report an update', () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    act(() => {
      latestSettingsStepProps.onUpdated?.();
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
  });

  it('stays on the iframe and shows an error notification when the preview save fails', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveError?.('boom');
    });

    expect(screen.getByText('boom')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeNull();
  });

  it('navigates away on a normal Save success without entering preview', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.(false);
    });

    await waitFor(() => expect(refetchDeployments).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeNull();
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'entityNotifications.quickApp.editedTitle',
      message: 'entityNotifications.quickApp.edited',
    });
  });

  it('raises no notification when the save was triggered by Preview', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.(true);
    });

    await screen.findByRole('button', {
      name: AppsEditorI18nKeys.ExitPreviewButton,
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('hides Cancel and Save while previewing', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.(false);
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    await screen.findByRole('button', {
      name: AppsEditorI18nKeys.ExitPreviewButton,
    });
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.Cancel }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
  });

  describe('Preview is reset when step is changed', () => {
    it('exits preview mode when the user navigates to a different step', async () => {
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      act(() => {
        latestSettingsStepProps.onSaveSuccess?.(false);
      });

      expect(refetchDeployments).toHaveBeenCalledOnce();
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      });
      expect(screen.getByText('settings-step').dataset.previewing).toBe('true');

      // Navigate to a different step
      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.StepGeneral }),
      );

      // Navigate to a different step
      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Settings }),
      );

      expect(screen.getByText('settings-step').dataset.previewing).toBe(
        'false',
      );
    });
  });

  describe('Settings step readiness gating', () => {
    it('disables Save and disables Preview before the Settings step is ready', () => {
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;

      expect(saveButton.disabled).toBe(true);
      const previewButton = screen.queryByRole('button', {
        name: BasicI18nKeys.Preview,
      }) as HTMLButtonElement;

      expect(previewButton?.disabled).toBe(true);
    });

    it('enables Save and shows Preview once the Settings step reports readiness', () => {
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      act(() => {
        latestSettingsStepProps.onReadyChange?.(true);
      });

      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;

      expect(saveButton.disabled).toBe(false);
      expect(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      ).toBeTruthy();
    });

    it('does not disable Next on the General step', () => {
      shouldSettingsAutoReady = false;
      renderEditor('step=general&schema=quickapps2-schema');

      const nextButton = screen.getByRole('button', {
        name: EditorI18nKeys.NextButton,
      }) as HTMLButtonElement;

      expect(nextButton.disabled).toBe(false);
    });

    it('surfaces an error when the Settings step never reports readiness within the readiness timeout', () => {
      vi.useFakeTimers();
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(
        screen.getByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
      ).toBeTruthy();
      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it('does not surface the readiness-timeout error once the Settings step becomes ready in time', () => {
      vi.useFakeTimers();
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      act(() => {
        latestSettingsStepProps.onReadyChange?.(true);
      });
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(
        screen.queryByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
      ).toBeNull();
    });

    it('does not surface the readiness-timeout error when a logged-out signal arrives first', () => {
      vi.useFakeTimers();
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      act(() => {
        latestSettingsStepProps.onLoggedOutChange?.(true);
      });
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(
        screen.queryByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
      ).toBeNull();
    });

    it('clears an already-surfaced readiness-timeout error once a logged-out signal arrives', () => {
      vi.useFakeTimers();
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(
        screen.getByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
      ).toBeTruthy();

      act(() => {
        latestSettingsStepProps.onLoggedOutChange?.(true);
      });

      expect(
        screen.queryByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
      ).toBeNull();
    });

    it('times out and re-enables Save with an error when no response arrives', () => {
      vi.useFakeTimers();
      renderEditor('step=settings&schema=quickapps2-schema');

      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;

      act(() => {
        saveButton.click();
      });
      expect(saveButton.disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(
        screen.getByText(AppsEditorI18nKeys.ErrorSaveTimeout),
      ).toBeTruthy();
      expect(saveButton.disabled).toBe(false);
    });

    it('clears the timeout when a real response arrives first', async () => {
      vi.useFakeTimers();
      renderEditor('step=settings&schema=quickapps2-schema');

      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;

      act(() => {
        saveButton.click();
      });
      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.(false);
        await Promise.resolve();
      });

      act(() => {
        vi.advanceTimersByTime(20000);
      });

      expect(
        screen.queryByText(AppsEditorI18nKeys.ErrorSaveTimeout),
      ).toBeNull();
    });
  });

  describe('Save & Exit forwards General values to the Settings step', () => {
    it('includes the current General values in triggerSave for an existing app', async () => {
      generalFormGetValues.mockReturnValue({
        name: 'Renamed App',
        description: 'desc',
      });
      renderEditor('step=general&schema=quickapps2-schema&appId=existing-app');

      act(() => {
        latestGeneralFormProps?.onCreated('existing-app', 'My App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      expect(settingsStepTriggerSave).toHaveBeenCalledWith({
        name: 'Renamed App',
        description: 'desc',
      });
    });

    it('includes display_version in triggerSave when the version field is set', async () => {
      generalFormGetValues.mockReturnValue({
        name: 'App',
        display_version: '2.0',
      });
      renderEditor('step=general&schema=quickapps2-schema&appId=existing-app');

      act(() => {
        latestGeneralFormProps?.onCreated('existing-app', 'App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      expect(settingsStepTriggerSave).toHaveBeenCalledWith({
        name: 'App',
        display_version: '2.0',
      });
    });

    it('does not include a general payload when saving a brand-new app created in this session', async () => {
      renderEditor('step=general&schema=quickapps2-schema');

      act(() => {
        latestGeneralFormProps?.onCreated('new-app', 'New App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      expect(settingsStepTriggerSave).toHaveBeenCalledWith(undefined);
    });

    it('does not include a general payload when triggering Preview', async () => {
      renderEditor('step=settings&schema=quickapps2-schema&appId=existing-app');

      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );

      expect(settingsStepTriggerSave).toHaveBeenCalledWith();
    });

    it('does not call update-application-style persistence on save success', async () => {
      renderEditor('step=general&schema=quickapps2-schema&appId=existing-app');

      act(() => {
        latestGeneralFormProps?.onCreated('existing-app', 'My App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.(false);
        await Promise.resolve();
      });

      await waitFor(() => expect(refetchDeployments).toHaveBeenCalledOnce());
    });
  });

  describe('Preview session reset on configuration change', () => {
    it('bumps the preview reset key when a save reports hasChanges: true', async () => {
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');
      const keyBefore = Number(
        screen.getByText('settings-step').dataset.previewResetKey,
      );

      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.(true);
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(
          Number(screen.getByText('settings-step').dataset.previewResetKey),
        ).toBe(keyBefore + 1),
      );
    });

    it('does not bump the preview reset key when a save reports hasChanges: false', async () => {
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');
      const keyBefore = Number(
        screen.getByText('settings-step').dataset.previewResetKey,
      );

      await userEvent.click(
        screen.getByRole('button', { name: BasicI18nKeys.Preview }),
      );
      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.(false);
        await Promise.resolve();
      });

      await waitFor(() => expect(refetchDeployments).toHaveBeenCalledOnce());
      expect(
        Number(screen.getByText('settings-step').dataset.previewResetKey),
      ).toBe(keyBefore);
    });
  });
});
