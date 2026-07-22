import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import AppsEditor from '../AppsEditor';

let latestSettingsStepProps: {
  onUpdated?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  isPreviewing?: boolean;
} = {};

let latestGeneralFormProps: {
  appId?: string;
  onCreated: (appId: string, displayName?: string, iconUrl?: string) => void;
} | null = null;

/* Most tests exercise Save/Preview behavior once the Settings step is ready,
 * so the mock auto-reports readiness on mount by default. Tests covering the
 * readiness-gating behavior itself flip this off before rendering. */
let shouldSettingsAutoReady = true;

const settingsStepTriggerSave = vi.fn();
const generalFormSubmit = vi.fn();
const generalFormPersist = vi.fn();

vi.mock('../SettingsStep', () => ({
  default: forwardRef(function MockSettingsStep(
    props: {
      onUpdated?: () => void;
      onSaveSuccess?: () => void;
      onSaveError?: (error: string) => void;
      onReadyChange?: (isReady: boolean) => void;
      isPreviewing?: boolean;
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
      <div data-previewing={props.isPreviewing ? 'true' : 'false'}>
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
      persist: generalFormPersist,
    }));
    return <div>general-form</div>;
  }),
}));

vi.mock('../../../context/DeploymentsContext');

const mockUseDeployments = vi.mocked(DeploymentsContextModule.useDeployments);
const refetchDeployments = vi.fn();

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
    generalFormPersist.mockReset().mockResolvedValue(undefined);
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
      latestSettingsStepProps.onSaveSuccess?.();
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('true');
  });

  it('waits for deployments refetch before entering preview mode', async () => {
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
      latestSettingsStepProps.onSaveSuccess?.();
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('false');
    expect(
      screen.getByLabelText(AppsEditorI18nKeys.SavingOverlayLabel),
    ).toBeTruthy();

    await act(async () => {
      resolveRefetch();
      await refetchPromise;
    });

    expect(
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('true');
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
      latestSettingsStepProps.onSaveSuccess?.();
    });

    await waitFor(() => expect(refetchDeployments).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeNull();
  });

  it('disables Cancel and Save while previewing', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: BasicI18nKeys.Preview }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.();
    });

    expect(refetchDeployments).toHaveBeenCalledOnce();
    const cancelButton = screen.getByRole('button', {
      name: ButtonsI18nKeys.Cancel,
    }) as HTMLButtonElement;
    await screen.findByRole('button', {
      name: AppsEditorI18nKeys.ExitPreviewButton,
    });
    expect(cancelButton.disabled).toBe(true);
    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
  });

  describe('Settings step readiness gating', () => {
    it('disables Save and hides Preview before the Settings step is ready', () => {
      shouldSettingsAutoReady = false;
      renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;

      expect(saveButton.disabled).toBe(true);
      expect(
        screen.queryByRole('button', { name: BasicI18nKeys.Preview }),
      ).toBeNull();
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
        vi.advanceTimersByTime(15000);
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

    it('times out and re-enables Save with an error when no response arrives', () => {
      vi.useFakeTimers();
      /* No appId: skips the persist step entirely so the save is triggered
       * synchronously within the click handler, keeping the fake-timer
       * assertions below deterministic. */
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
        latestSettingsStepProps.onSaveSuccess?.();
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

  describe('Save & Exit persist sequencing', () => {
    it('triggers the Settings step save before persisting General fields for an existing app', async () => {
      renderEditor('step=general&schema=quickapps2-schema&appId=existing-app');

      act(() => {
        latestGeneralFormProps?.onCreated('existing-app', 'My App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      expect(settingsStepTriggerSave).toHaveBeenCalledOnce();
      expect(generalFormPersist).not.toHaveBeenCalled();

      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.();
        await Promise.resolve();
      });

      await waitFor(() => expect(generalFormPersist).toHaveBeenCalledOnce());
      const triggerOrder = settingsStepTriggerSave.mock.invocationCallOrder[0];
      const persistOrder = generalFormPersist.mock.invocationCallOrder[0];
      expect(triggerOrder).toBeLessThan(persistOrder);
    });

    it('surfaces an error and does not exit when persist fails after the Settings step save succeeds', async () => {
      generalFormPersist.mockRejectedValue(new Error('network error'));
      renderEditor('step=general&schema=quickapps2-schema&appId=existing-app');

      act(() => {
        latestGeneralFormProps?.onCreated('existing-app', 'My App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.();
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(
          screen.getByText(AppsEditorI18nKeys.ErrorSaveFailed),
        ).toBeTruthy(),
      );
      const saveButton = screen.getByRole('button', {
        name: EditorI18nKeys.SaveButton,
      }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
    });

    it('skips persist entirely for a brand-new app', async () => {
      renderEditor('step=general&schema=quickapps2-schema');

      act(() => {
        latestGeneralFormProps?.onCreated('new-app', 'New App', undefined);
      });

      await userEvent.click(
        screen.getByRole('button', { name: EditorI18nKeys.SaveButton }),
      );

      await act(async () => {
        latestSettingsStepProps.onSaveSuccess?.();
        await Promise.resolve();
      });

      expect(generalFormPersist).not.toHaveBeenCalled();
    });
  });
});
