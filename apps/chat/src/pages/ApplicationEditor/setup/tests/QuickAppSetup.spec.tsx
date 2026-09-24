import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import { act, render, screen } from '@testing-library/react';
import { createRef, forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationEditorI18nKeys,
  AppsEditorI18nKeys,
} from '../../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../../context/DeploymentsContext';
import type { ApplicationSetupHandle } from '../../../../models/application-editor';
import { updateApplication } from '../../../../server-api/applications';
import type { TriggerSaveGeneralPayload } from '../../../../types/apps-editor';
import QuickAppSetup from '../QuickAppSetup';

interface IframeStubProps {
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
  onLoggedOutChange?: (isLoggedOut: boolean) => void;
}

/* Records every render of the embedded-editor stub, so tests can play the iframe's messages. */
const captureIframeProps = vi.fn<(props: IframeStubProps) => void>();
const getIframeProps = () => captureIframeProps.mock.lastCall?.[0];
const mockTriggerSave = vi.fn<(general?: TriggerSaveGeneralPayload) => void>();

vi.mock('../AppEditorIframe', () => ({
  default: forwardRef(function AppEditorIframeStub(
    props: IframeStubProps,
    ref,
  ) {
    captureIframeProps(props);
    useImperativeHandle(ref, () => ({ triggerSave: mockTriggerSave }));
    return <div>embedded-editor</div>;
  }),
}));
vi.mock('../AppPreviewChat', () => ({
  default: () => <div>preview-chat</div>,
}));
vi.mock('../../../../server-api/applications', () => ({
  updateApplication: vi.fn(),
}));
vi.mock('../../../../context/DeploymentsContext');

const SCHEMA_WITH_EDITOR = {
  id: 'schema-with-editor',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};
const SCHEMA_WITHOUT_EDITOR = { id: 'schema-without-editor' };

const METADATA: DeploymentCreationFormValues = {
  name: ' My App ',
  description: '',
  iconUrl: '',
  version: '1.2',
  topics: [],
  otherLocales: [],
};

const mockRefetchDeployments = vi.fn();
const mockOnReadyChange = vi.fn();

const mountSetup = ({
  appId,
  schemaId = SCHEMA_WITH_EDITOR.id,
}: {
  appId?: string;
  schemaId?: string;
}) => {
  const ref = createRef<ApplicationSetupHandle>();
  render(
    <MemoryRouter initialEntries={[`/apps-editor?schema=${schemaId}`]}>
      <QuickAppSetup
        ref={ref}
        value={{}}
        errors={{}}
        onChange={vi.fn()}
        onFieldBlur={vi.fn()}
        isEditMode={Boolean(appId)}
        appId={appId}
        metadata={METADATA}
        isPreviewing={false}
        onReadyChange={mockOnReadyChange}
      />
    </MemoryRouter>,
  );
  return ref;
};

describe('QuickAppSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetchDeployments.mockResolvedValue(undefined);
    vi.mocked(updateApplication).mockResolvedValue({ id: 'app' } as never);
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
      schemas: [SCHEMA_WITH_EDITOR, SCHEMA_WITHOUT_EDITOR],
      refetchDeployments: mockRefetchDeployments,
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the pending-create placeholder and reports ready before the app exists', () => {
    mountSetup({});

    expect(
      screen.getByText(ApplicationEditorI18nKeys.SetupPendingCreate),
    ).toBeTruthy();
    expect(screen.queryByText('embedded-editor')).toBeNull();
    expect(mockOnReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the no-editor placeholder and resolves a save without posting a message', async () => {
    const handle = mountSetup({
      appId: 'app',
      schemaId: SCHEMA_WITHOUT_EDITOR.id,
    });

    expect(
      screen.getByText(AppsEditorI18nKeys.SettingsStepNoEditorPlaceholder),
    ).toBeTruthy();
    await act(() => handle.current?.save(METADATA));
    expect(mockTriggerSave).not.toHaveBeenCalled();
  });

  it('renders the embedded editor and reports its readiness', () => {
    mountSetup({ appId: 'app' });

    expect(screen.getByText('embedded-editor')).toBeTruthy();
    expect(mockOnReadyChange).toHaveBeenLastCalledWith(false);

    act(() => getIframeProps()?.onReadyChange?.(true));

    expect(mockOnReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('forwards the trimmed Metadata to the embedded editor and reasserts on save', async () => {
    const handle = mountSetup({ appId: 'app' });

    let savePromise: Promise<void> | undefined;
    act(() => {
      savePromise = handle.current?.save(METADATA);
    });
    expect(mockTriggerSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My App', display_version: '1.2' }),
    );

    await act(async () => {
      getIframeProps()?.onSaveSuccess?.(false);
      await savePromise;
    });

    expect(updateApplication).toHaveBeenCalledWith(
      'app',
      expect.objectContaining({ name: 'My App' }),
    );
  });

  it('times out a save that never gets a response and shows the timeout error', async () => {
    vi.useFakeTimers();
    const handle = mountSetup({ appId: 'app' });

    let saveError: unknown;
    act(() => {
      handle.current?.save(METADATA).catch((error: unknown) => {
        saveError = error;
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(saveError).toBeInstanceOf(Error);
    expect(screen.getByText(AppsEditorI18nKeys.ErrorSaveTimeout)).toBeTruthy();
    expect(updateApplication).not.toHaveBeenCalled();
  });

  it('surfaces the not-ready error when the editor never reports readiness', async () => {
    vi.useFakeTimers();
    mountSetup({ appId: 'app' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(
      screen.getByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
    ).toBeTruthy();
  });

  it('does not surface the not-ready error once the editor reports the user is logged out', async () => {
    vi.useFakeTimers();
    mountSetup({ appId: 'app' });

    act(() => getIframeProps()?.onLoggedOutChange?.(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(
      screen.queryByText(AppsEditorI18nKeys.ErrorSettingsNotReady),
    ).toBeNull();
  });
});
