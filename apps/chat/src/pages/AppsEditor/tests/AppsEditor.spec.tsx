import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  isPreviewing?: boolean;
} = {};

vi.mock('../SettingsStep', () => ({
  default: forwardRef(function MockSettingsStep(
    props: {
      onUpdated?: () => void;
      onSaveSuccess?: () => void;
      onSaveError?: (error: string) => void;
      isPreviewing?: boolean;
    },
    ref,
  ) {
    latestSettingsStepProps = props;
    useImperativeHandle(ref, () => ({ triggerSave: vi.fn() }));
    return (
      <div data-previewing={props.isPreviewing ? 'true' : 'false'}>
        settings-step
      </div>
    );
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
    mockUseDeployments.mockReturnValue({
      schemas: [SCHEMA],
      items: [],
      refetchDeployments,
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
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
});
