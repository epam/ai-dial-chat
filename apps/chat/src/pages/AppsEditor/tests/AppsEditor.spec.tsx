import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import AppsEditor from '../AppsEditor';

let latestSettingsStepProps: {
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
  isPreviewing?: boolean;
} = {};

vi.mock('../SettingsStep', () => ({
  default: forwardRef(function MockSettingsStep(
    props: {
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
    latestSettingsStepProps = {};
    mockUseDeployments.mockReturnValue({
      schemas: [SCHEMA],
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  it('does not show the preview button on the General step', () => {
    renderEditor('step=general&schema=quickapps2-schema');

    expect(
      screen.queryByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
    ).not.toBeTruthy();
  });

  it('shows the preview button on the Settings step with a saved app id', () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    expect(
      screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
    ).toBeTruthy();
  });

  it('enters preview mode when the preview save succeeds', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.();
    });

    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
    expect(screen.getByText('settings-step').dataset.previewing).toBe('true');
  });

  it('stays on the iframe and shows an error notification when the preview save fails', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
    );
    act(() => {
      latestSettingsStepProps.onSaveError?.('boom');
    });

    expect(screen.getByText('boom')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
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
      screen.getByRole('button', { name: AppsEditorI18nKeys.SaveButton }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.();
    });

    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeNull();
  });

  it('disables Cancel and Save while previewing', async () => {
    renderEditor('step=settings&schema=quickapps2-schema&appId=abc');

    await userEvent.click(
      screen.getByRole('button', { name: AppsEditorI18nKeys.PreviewButton }),
    );
    act(() => {
      latestSettingsStepProps.onSaveSuccess?.();
    });

    const cancelButton = screen.getByRole('button', {
      name: ButtonsI18nKeys.Cancel,
    }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);
    expect(
      screen.getByRole('button', {
        name: AppsEditorI18nKeys.ExitPreviewButton,
      }),
    ).toBeTruthy();
  });
});
