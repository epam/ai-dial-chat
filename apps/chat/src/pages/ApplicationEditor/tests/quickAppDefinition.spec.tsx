import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApplicationEditorI18nKeys,
  AppsEditorI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import * as DeploymentsContextModule from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import { ApplicationEditorKind } from '../../../types/application-editor';
import type { TriggerSaveGeneralPayload } from '../../../types/apps-editor';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import ApplicationEditorPage from '../ApplicationEditorPage';

interface IframeStubProps {
  appId: string;
  onSaveSuccess?: (hasChanges: boolean) => void;
  onSaveError?: (error: string) => void;
  onReadyChange?: (isReady: boolean) => void;
}

/* Records every render of the embedded-editor stub, so tests can play the iframe's messages. */
const captureIframeProps = vi.fn<(props: IframeStubProps) => void>();
const getIframeProps = () => captureIframeProps.mock.lastCall?.[0];
const mockTriggerSave = vi.fn<(general?: TriggerSaveGeneralPayload) => void>();

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ status: 'ready', config: {} }),
}));
vi.mock('../setup/AppEditorIframe', () => ({
  default: forwardRef(function AppEditorIframeStub(
    props: IframeStubProps,
    ref,
  ) {
    captureIframeProps(props);
    useImperativeHandle(ref, () => ({ triggerSave: mockTriggerSave }));
    return <div>{`embedded-editor-${props.appId}`}</div>;
  }),
}));
vi.mock('../setup/AppPreviewChat', () => ({
  default: () => <div>preview-chat</div>,
}));
vi.mock('../../../server-api/applications', () => ({
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mockNotifyOperationSuccess,
  }),
}));
vi.mock(
  '../../../components/DialFileManagerModal/DialFileManagerModal',
  () => ({ default: () => null }),
);

const mockShowNotification = vi.fn();
const mockRefetchDeployments = vi.fn();
const mockNotifyOperationSuccess = vi.fn();

const SCHEMA = {
  id: 'https://example.com/schemas/quickapps2',
  displayName: 'QuickApp',
  editorUrl: 'https://editor.example.com',
};
const APP_ID = 'applications/bucket/my-app';

const LocationProbe = () => {
  const location = useLocation();
  return <output>{`location:${location.search}`}</output>;
};

/* Extracted so a test can `rerender` the identical tree after changing a mock's return value. */
const buildTree = (search: string) => (
  <MemoryRouter initialEntries={[`${ROUTES.AppsEditor}?${search}`]}>
    <Routes>
      <Route
        path={ROUTES.AppsEditor}
        element={
          <>
            <ApplicationEditorPage kind={ApplicationEditorKind.QuickApp} />
            <LocationProbe />
          </>
        }
      />
      <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
    </Routes>
  </MemoryRouter>
);

const renderPage = (search: string) => render(buildTree(search));

/* The layout renders its actions in the header and again in the mobile bar; take the header copy. */
const getAction = (name: string) =>
  screen.getAllByRole('button', { name })[0] as HTMLButtonElement;
const queryAction = (name: string) =>
  screen.queryAllByRole('button', { name })[0];
const getNameInput = () =>
  screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false });

const createSearch = `schema=${SCHEMA.id}`;
const editSearch = `${createSearch}&appId=${encodeURIComponent(APP_ID)}`;

describe('ApplicationEditorPage — quick app', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetchDeployments.mockResolvedValue(undefined);
    vi.mocked(createApplication).mockResolvedValue({ id: APP_ID } as never);
    vi.mocked(updateApplication).mockResolvedValue({ id: APP_ID } as never);
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
      schemas: [SCHEMA],
      items: [],
      isLoading: false,
      refetchDeployments: mockRefetchDeployments,
    } as unknown as ReturnType<typeof DeploymentsContextModule.useDeployments>);
  });

  describe('create mode', () => {
    it('shows the Metadata fields and a pending Setup, with no Preview', () => {
      renderPage(createSearch);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: AppsEditorI18nKeys.CreateTitle,
        }),
      ).toBeTruthy();
      expect(getNameInput()).toBeTruthy();
      expect(
        screen.getByText(ApplicationEditorI18nKeys.SetupPendingCreate),
      ).toBeTruthy();
      expect(screen.queryByText(/embedded-editor-/)).toBeNull();
      expect(queryAction(BasicI18nKeys.Preview)).toBeUndefined();
      expect(getAction(ButtonsI18nKeys.Create).disabled).toBe(false);
    });

    it('blocks the request and shows the required error for an empty name', async () => {
      renderPage(createSearch);

      await user.click(getAction(ButtonsI18nKeys.Create));

      expect(screen.getByText(EditorI18nKeys.NameRequired)).toBeTruthy();
      expect(createApplication).not.toHaveBeenCalled();
    });

    it('blocks the request for a name with forbidden characters and a non-semver version', async () => {
      renderPage(createSearch);

      await user.type(getNameInput(), 'Bad/name');
      await user.type(
        screen.getByLabelText(EditorI18nKeys.VersionLabel),
        'v1-beta',
      );
      await user.click(getAction(ButtonsI18nKeys.Create));

      expect(
        screen.getByText(AppsEditorI18nKeys.GeneralFormNameInvalid),
      ).toBeTruthy();
      expect(screen.getByText(EditorI18nKeys.VersionInvalid)).toBeTruthy();
      expect(createApplication).not.toHaveBeenCalled();
    });

    it('creates the app with seeded properties, confirms it and switches to edit mode in place', async () => {
      const { rerender } = renderPage(createSearch);

      await user.type(getNameInput(), 'My App');
      await user.click(getAction(ButtonsI18nKeys.Create));

      await screen.findByText(`embedded-editor-${APP_ID}`);
      expect(createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My App',
          type: SCHEMA.id,
          applicationProperties: {
            orchestrator: {
              system_prompt: { type: 'custom', variables: {}, content: '' },
            },
            contexts: [],
            tool_sets: [],
          },
        }),
      );
      expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
        NotifiableEntity.QuickApp,
        EntityOperation.Created,
        { name: 'My App' },
      );
      expect(
        screen.getByText(new RegExp(`appId=${encodeURIComponent(APP_ID)}`)),
      ).toBeTruthy();
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: AppsEditorI18nKeys.EditTitle,
        }),
      ).toBeTruthy();
      expect(getAction(ButtonsI18nKeys.Save)).toBeTruthy();
      /*
       * Regression guard for #9169: the create->edit switch itself must never
       * blank the Name field, even though the deployments list has not yet
       * caught up with the newly created app at this point (`items` below is
       * still the empty array from `beforeEach`).
       */
      expect((getNameInput() as HTMLInputElement).value).toBe('My App');

      /*
       * The deployments list later catches up with the newly created app —
       * with a *different* displayName, standing in for an edit the user
       * could have typed during the fire-and-forget refetch's race window
       * (switchToCreatedApp's refetch does not gate the form as busy). The
       * Metadata form must never reseed from it: once a metadata-first
       * create has switched this session into edit mode, the already-
       * submitted values are authoritative for the rest of the session.
       */
      vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
        schemas: [SCHEMA],
        items: [{ id: APP_ID, displayName: 'My App (server)' }],
        isLoading: false,
        refetchDeployments: mockRefetchDeployments,
      } as unknown as ReturnType<
        typeof DeploymentsContextModule.useDeployments
      >);
      rerender(buildTree(createSearch));

      expect((getNameInput() as HTMLInputElement).value).toBe('My App');
    });

    it('raises an error notification and stays on the page when create fails', async () => {
      vi.mocked(createApplication).mockRejectedValue(new Error(''));
      renderPage(createSearch);

      await user.type(getNameInput(), 'My App');
      await user.click(getAction(ButtonsI18nKeys.Create));

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: NotificationVariant.Error,
            message: AppsEditorI18nKeys.ErrorCreateFailed,
          }),
        ),
      );
      expect(screen.queryByText(/embedded-editor-/)).toBeNull();
    });
  });

  describe('edit mode', () => {
    const typeName = async () => {
      await user.type(getNameInput(), 'My App');
    };

    it('reseeds the Name field once the resolved deployment arrives (e.g. a reload right after creation)', async () => {
      /*
       * Regression guard for #9169: opening directly in edit mode (a fresh
       * mount, distinct from the metadata-first create->edit switch covered
       * above) must recover the persisted name once the deployments list
       * resolves — this is the one case where a reseed is desired.
       */
      const { rerender } = renderPage(editSearch);

      expect((getNameInput() as HTMLInputElement).value).toBe('');

      vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
        schemas: [SCHEMA],
        items: [{ id: APP_ID, displayName: 'My App' }],
        isLoading: false,
        refetchDeployments: mockRefetchDeployments,
      } as unknown as ReturnType<
        typeof DeploymentsContextModule.useDeployments
      >);
      rerender(buildTree(editSearch));

      expect((getNameInput() as HTMLInputElement).value).toBe('My App');
    });

    it('keeps Save and Preview disabled until the embedded editor is ready to save', async () => {
      renderPage(editSearch);

      expect(getAction(ButtonsI18nKeys.Save).disabled).toBe(true);
      expect(getAction(BasicI18nKeys.Preview).disabled).toBe(true);

      act(() => getIframeProps()?.onReadyChange?.(true));

      await waitFor(() =>
        expect(getAction(ButtonsI18nKeys.Save).disabled).toBe(false),
      );
      expect(getAction(BasicI18nKeys.Preview).disabled).toBe(false);
    });

    it('forwards the Metadata to the embedded editor on Save, reasserts, confirms and exits', async () => {
      renderPage(editSearch);
      await typeName();
      await user.type(
        screen.getByLabelText(EditorI18nKeys.VersionLabel),
        '2.0.0',
      );
      act(() => getIframeProps()?.onReadyChange?.(true));

      await user.click(getAction(ButtonsI18nKeys.Save));

      await waitFor(() => expect(mockTriggerSave).toHaveBeenCalledOnce());
      const general = mockTriggerSave.mock.calls[0][0];
      expect(general).toEqual(
        expect.objectContaining({ name: 'My App', display_version: '2.0.0' }),
      );
      expect(general).not.toHaveProperty('version');

      act(() => getIframeProps()?.onSaveSuccess?.(false));

      await screen.findByText('Catalog');
      expect(updateApplication).toHaveBeenCalledWith(
        APP_ID,
        expect.objectContaining({ name: 'My App' }),
      );
      expect(mockRefetchDeployments).toHaveBeenCalled();
      expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
        NotifiableEntity.QuickApp,
        EntityOperation.Edited,
        { name: 'My App' },
      );
    });

    it('shows the embedded editor’s save error inline and stays on the page', async () => {
      renderPage(editSearch);
      await typeName();
      act(() => getIframeProps()?.onReadyChange?.(true));

      await user.click(getAction(ButtonsI18nKeys.Save));
      await waitFor(() => expect(mockTriggerSave).toHaveBeenCalledOnce());
      act(() => getIframeProps()?.onSaveError?.('Upstream rejected'));

      expect(await screen.findByText('Upstream rejected')).toBeTruthy();
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(mockNotifyOperationSuccess).not.toHaveBeenCalled();
    });

    const enterPreview = async () => {
      await user.click(getAction(BasicI18nKeys.Preview));
      await waitFor(() => expect(mockTriggerSave).toHaveBeenCalledOnce());
      act(() => getIframeProps()?.onSaveSuccess?.(true));
      return screen.findByRole('button', {
        name: AppsEditorI18nKeys.PreviewBackToSetup,
      });
    };

    it('hides Preview for an external application that only has an embedded editor', () => {
      const externalSchema = {
        id: 'https://example.com/schemas/external-app',
        displayName: 'External app',
        editorUrl: 'https://external.example.com',
      };
      vi.mocked(DeploymentsContextModule.useDeployments).mockReturnValue({
        schemas: [SCHEMA, externalSchema],
        items: [],
        isLoading: false,
        refetchDeployments: mockRefetchDeployments,
      } as unknown as ReturnType<
        typeof DeploymentsContextModule.useDeployments
      >);

      renderPage(
        `schema=${externalSchema.id}&appId=${encodeURIComponent(APP_ID)}`,
      );

      expect(screen.getByText(`embedded-editor-${APP_ID}`)).toBeTruthy();
      expect(getAction(ButtonsI18nKeys.Save)).toBeTruthy();
      expect(queryAction(BasicI18nKeys.Preview)).toBeUndefined();
      expect(screen.queryByText('preview-chat')).toBeNull();
    });

    it('renders the Preview button as a plain action, not a toggle', () => {
      renderPage(editSearch);

      expect(
        getAction(BasicI18nKeys.Preview).hasAttribute('aria-pressed'),
      ).toBe(false);
    });

    it('opens a full-page preview after a save without Metadata and hides the editor', async () => {
      renderPage(editSearch);
      await typeName();
      act(() => getIframeProps()?.onReadyChange?.(true));

      const backToSetup = await enterPreview();

      expect(mockTriggerSave).toHaveBeenCalledWith(undefined);
      expect(mockRefetchDeployments).toHaveBeenCalled();
      expect(mockNotifyOperationSuccess).not.toHaveBeenCalled();
      expect(screen.getByText('preview-chat')).toBeTruthy();
      expect(queryAction(BasicI18nKeys.Preview)).toBeUndefined();
      expect(queryAction(ButtonsI18nKeys.Save)).toBeUndefined();
      expect(queryAction(ButtonsI18nKeys.Cancel)).toBeUndefined();
      expect(
        screen.queryByRole('heading', {
          level: 1,
          name: AppsEditorI18nKeys.EditTitle,
        }),
      ).toBeNull();
      expect(backToSetup.matches(':focus')).toBe(true);
    });

    it('returns to the same embedded editor on Back to setup and focuses Preview', async () => {
      renderPage(editSearch);
      await typeName();
      act(() => getIframeProps()?.onReadyChange?.(true));
      const editorBefore = screen.getByText(`embedded-editor-${APP_ID}`);

      await user.click(await enterPreview());

      expect(getAction(ButtonsI18nKeys.Save)).toBeTruthy();
      expect(screen.getByText(`embedded-editor-${APP_ID}`)).toBe(editorBefore);
      expect(mockTriggerSave).toHaveBeenCalledOnce();
      expect(
        screen
          .getAllByRole('button', { name: BasicI18nKeys.Preview })
          .some((button) => button.matches(':focus')),
      ).toBe(true);
      expect(
        screen.queryByRole('button', {
          name: AppsEditorI18nKeys.PreviewBackToSetup,
        }),
      ).toBeNull();
    });

    it('opens a legacy Settings-step link in edit mode', () => {
      renderPage(`step=settings&${editSearch}`);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: AppsEditorI18nKeys.EditTitle,
        }),
      ).toBeTruthy();
      expect(screen.getByText(`embedded-editor-${APP_ID}`)).toBeTruthy();
    });
  });
});
