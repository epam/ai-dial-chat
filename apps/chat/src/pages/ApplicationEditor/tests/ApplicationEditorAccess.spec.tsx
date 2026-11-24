import {
  ApplicationErrorCode,
  CatalogCreationType,
  ResourceDependencyAccess,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  CustomAppI18nKeys,
  EditorI18nKeys,
  UnsavedChangesI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { resetCatalogCreationState } from '../../../context/tests/catalog-creation-state';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
import type {
  ApplicationEditorFormDefinition,
  ApplicationSetupProps,
} from '../../../models/application-editor';
import { applicationsApi } from '../../../server-api/api-client';
import {
  getApplicationResourceDependencies,
  updateApplicationAccess,
} from '../../../server-api/applications';
import { publishApiClient } from '../../../server-api/publish.api';
import {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../../../types/application-editor';
import { NotifiableEntity } from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import { defineApplicationEditor } from '../../../utils/application-editor';
import ApplicationEditorPage from '../ApplicationEditorPage';

interface FakeSetup extends Record<string, unknown> {
  endpoint: string;
}

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockShowNotification = vi.fn();
const mockRefetchDeployments = vi.fn();

const {
  ACCESS_KIND,
  PLAIN_KIND,
  FIRST_KIND,
  PANEL_KIND,
  PANEL_FIRST_KIND,
  EMBEDDED_KIND,
} = vi.hoisted(() => ({
  EMBEDDED_KIND: 'fake-embedded-kind' as ApplicationEditorKind,
  PANEL_KIND: 'fake-panel-kind' as ApplicationEditorKind,
  PANEL_FIRST_KIND: 'fake-panel-first-kind' as ApplicationEditorKind,
  ACCESS_KIND: 'fake-access-kind' as ApplicationEditorKind,
  PLAIN_KIND: 'fake-plain-kind' as ApplicationEditorKind,
  FIRST_KIND: 'fake-metadata-first-kind' as ApplicationEditorKind,
}));

const FakeSetupForm = ({
  value,
  onChange,
}: ApplicationSetupProps<FakeSetup>) => (
  <label>
    fake-endpoint
    <input
      value={value.endpoint}
      onChange={(event) => onChange({ endpoint: event.target.value })}
    />
  </label>
);

const baseDefinition: Omit<
  ApplicationEditorFormDefinition<FakeSetup>,
  'kind' | 'createStrategy' | 'hasAccess'
> = {
  creationType: CatalogCreationType.CustomApp,
  notifiableEntity: NotifiableEntity.CustomApp,
  idQueryParam: 'id',
  messageKeys: {
    createTitle: CustomAppI18nKeys.CreateTitle,
    editTitle: CustomAppI18nKeys.EditTitle,
    createFailed: CustomAppI18nKeys.ErrorCreateFailed,
    saveFailed: CustomAppI18nKeys.ErrorSaveFailed,
    loadFailed: CustomAppI18nKeys.ErrorLoadFailed,
    savingOverlay: CustomAppI18nKeys.SavingOverlayLabel,
    loadingOverlay: CustomAppI18nKeys.LoadingOverlayLabel,
  },
  metadataValidation: {},
  defaultMetadata: {
    name: 'Fake app',
    description: '',
    iconUrl: '',
    version: '1.0.0',
    topics: [],
    otherLocales: [],
  },
  defaultSetup: { endpoint: '' },
  validateSetup: () => ({}),
  Setup: FakeSetupForm,
  create: mockCreate,
  update: mockUpdate,
};

const accessDefinition = defineApplicationEditor<FakeSetup>({
  ...baseDefinition,
  kind: ACCESS_KIND,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
  hasAccess: true,
});
const plainDefinition = defineApplicationEditor<FakeSetup>({
  ...baseDefinition,
  kind: PLAIN_KIND,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
});
const metadataFirstDefinition = defineApplicationEditor<FakeSetup>({
  ...baseDefinition,
  kind: FIRST_KIND,
  createStrategy: ApplicationCreateStrategy.MetadataFirst,
  hasAccess: true,
});

vi.mock('../../../context/AppConfigContext', async () => {
  const { useCatalogCreationState } =
    await import('../../../context/tests/catalog-creation-state');
  return {
    useAppConfig: () => ({
      status: 'ready',
      config: { additionalContentLocales: [] },
      ...useCatalogCreationState(),
    }),
  };
});
const panelDefinition = defineApplicationEditor<FakeSetup>({
  ...baseDefinition,
  kind: PANEL_KIND,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
  hasAccess: true,
  savePanel: { getTypeLabel: () => 'Fake' },
});
const FakeEmbeddedSetup = forwardRef<unknown, ApplicationSetupProps<FakeSetup>>(
  function FakeEmbeddedSetup(props, ref) {
    useImperativeHandle(ref, () => ({ save: mockEmbeddedSave }));
    return <FakeSetupForm {...props} />;
  },
);

const { update: _unusedUpdate, ...embeddedBase } = baseDefinition;
const embeddedDefinition = defineApplicationEditor<FakeSetup>({
  ...embeddedBase,
  Setup: FakeEmbeddedSetup as typeof FakeSetupForm,
  kind: EMBEDDED_KIND,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
  hasAccess: true,
  savePanel: { getTypeLabel: () => 'Fake' },
});
const panelFirstDefinition = defineApplicationEditor<FakeSetup>({
  ...baseDefinition,
  kind: PANEL_FIRST_KIND,
  createStrategy: ApplicationCreateStrategy.MetadataFirst,
  hasAccess: true,
  savePanel: { getTypeLabel: () => 'Fake' },
});

vi.mock('../definitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../definitions')>();
  return {
    APPLICATION_EDITOR_DEFINITIONS: {
      ...actual.APPLICATION_EDITOR_DEFINITIONS,
      get [ACCESS_KIND]() {
        return accessDefinition;
      },
      get [PLAIN_KIND]() {
        return plainDefinition;
      },
      get [FIRST_KIND]() {
        return metadataFirstDefinition;
      },
      get [PANEL_KIND]() {
        return panelDefinition;
      },
      get [EMBEDDED_KIND]() {
        return embeddedDefinition;
      },
      get [PANEL_FIRST_KIND]() {
        return panelFirstDefinition;
      },
    },
  };
});
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'b' } }),
}));
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [{ id: 'app-1', isMy: true, displayName: 'Fake app' }],
    refetchDeployments: mockRefetchDeployments,
    isLoading: false,
  }),
}));
vi.mock('../../../hooks/useOperationNotification', () => ({
  useOperationNotification: () => ({ notifyOperationSuccess: vi.fn() }),
}));
vi.mock(
  '../../../components/DialFileManagerModal/DialFileManagerModal',
  () => ({ default: () => null }),
);
vi.mock('../../../server-api/applications');
const mockPublish = vi.fn();
const mockEmbeddedSave = vi.fn();

/*
 * Runs the real `runResourceSave` against the adapter the editor built, the way
 * the panel does, and shows a failed save inline as the panel does.
 */
vi.mock(
  '../../../components/ResourceSavePanelContainer/ResourceSavePanelContainer',
  async () => {
    const hooks = await import('@epam/ai-dial-chat-hooks');
    const { SaveVersionMode } = await import('@epam/ai-dial-publish-panel');
    const { useState } = await import('react');
    return {
      default: (props: {
        isOpen: boolean;
        adapter: Parameters<typeof hooks.runResourceSave>[0];
        onSaved: (result: unknown) => void;
        onClose: () => void;
      }) => {
        const [error, setError] = useState('');
        if (!props.isOpen) return null;
        const run = async (
          choice: Partial<Parameters<typeof hooks.runResourceSave>[1]>,
        ) => {
          setError('');
          try {
            const result = await hooks.runResourceSave(
              props.adapter,
              {
                resourceId: 'app-1',
                currentFolderPath: [],
                currentVersion: '1.0.0',
                destination: { rootKey: 'personal', path: [] },
                versionMode: SaveVersionMode.Keep,
                newVersion: '',
                ...choice,
              },
              mockPublish,
            );
            props.onSaved(result);
          } catch (caught) {
            setError(
              caught instanceof hooks.ResourceSaveError
                ? caught.message
                : 'panel-generic-error',
            );
          }
        };
        return (
          <div role="dialog" aria-label="save-panel">
            <button onClick={() => void run({})}>panel-save</button>
            <button
              onClick={() =>
                void run({
                  versionMode: SaveVersionMode.New,
                  newVersion: '2.0.0',
                })
              }
            >
              panel-save-new-version
            </button>
            <button
              onClick={() =>
                void run({
                  destination: { rootKey: 'organization', path: ['Org'] },
                })
              }
            >
              panel-publish
            </button>
            <button
              onClick={() =>
                void run({
                  destination: { rootKey: 'organization', path: ['Unit'] },
                  isDirectWrite: true,
                })
              }
            >
              panel-write-to-org-unit
            </button>
            <button onClick={props.onClose}>panel-close</button>
            <span>{error}</span>
          </div>
        );
      },
    };
  },
);

const FILES = {
  linkId: 'f',
  target: { url: 'files/{current-user}/' },
  access: [ResourceDependencyAccess.Read],
};
const POLICIES = {
  linkId: 'p',
  target: { url: 'files/public/policies/' },
  access: [ResourceDependencyAccess.Read],
  required: true,
};

const renderKind = (kind: ApplicationEditorKind, search = '') =>
  renderWithLeaveGuard(
    <Routes>
      <Route path="/editor" element={<ApplicationEditorPage kind={kind} />} />
      <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
    </Routes>,
    [`/editor${search}`],
  );

const getAction = (name: string) => screen.getAllByRole('button', { name })[0];

const serverError = () =>
  new ResponseError(new Response('{}', { status: 500 }));

const refusal = () =>
  new ResponseError(
    new Response(
      JSON.stringify({
        statusCode: 403,
        code: ApplicationErrorCode.ApplicationResourceDependenciesNotAllowed,
        message: 'fixed',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
  );

describe('ApplicationEditor Access section', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.resetAllMocks();
    resetCatalogCreationState();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    mockCreate.mockResolvedValue({ id: 'new-id' });
    mockUpdate.mockResolvedValue(undefined);
    mockRefetchDeployments.mockResolvedValue(undefined);
    vi.mocked(getApplicationResourceDependencies).mockResolvedValue({
      resourceDependencies: [FILES, POLICIES],
    });
    vi.mocked(updateApplicationAccess).mockResolvedValue({ id: 'x' });
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the section for a kind that has it', () => {
    renderKind(ACCESS_KIND);
    expect(
      screen.getByRole('button', { name: AppsEditorI18nKeys.AccessConfigure }),
    ).toBeTruthy();
    expect(getApplicationResourceDependencies).not.toHaveBeenCalled();
  });

  it('shows no section for a kind without it', () => {
    renderKind(PLAIN_KIND, '?id=app-1');
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeNull();
    expect(getApplicationResourceDependencies).not.toHaveBeenCalled();
  });

  it('shows a loading indicator, then the stored entries, when an existing application opens', async () => {
    renderKind(ACCESS_KIND, '?id=app-1');

    expect(
      screen.getByRole('img', { name: AppsEditorI18nKeys.AccessLoading }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeNull();

    expect(
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeTruthy();
    expect(getApplicationResourceDependencies).toHaveBeenCalledWith('app-1');
    expect(screen.getByText(/files\/public\/policies\//)).toBeTruthy();
  });

  it('shows an error with a retry action when the stored list cannot be read, and sends nothing for Access', async () => {
    vi.mocked(getApplicationResourceDependencies).mockRejectedValueOnce(
      new Error('network'),
    );
    renderKind(ACCESS_KIND, '?id=app-1');

    expect(
      await screen.findByText(AppsEditorI18nKeys.AccessLoadFailed),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeNull();

    await user.click(getAction(ButtonsI18nKeys.Save));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(updateApplicationAccess).not.toHaveBeenCalled();
  });

  it('reads the list again on retry', async () => {
    vi.mocked(getApplicationResourceDependencies).mockRejectedValueOnce(
      new Error('network'),
    );
    renderKind(ACCESS_KIND, '?id=app-1');

    await user.click(
      await screen.findByRole('button', {
        name: ButtonsI18nKeys.Retry,
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      }),
    ).toBeTruthy();
  });

  it('asks before leaving when only the Access section changed', async () => {
    renderKind(ACCESS_KIND, '?id=app-1');
    await screen.findByRole('button', {
      name: AppsEditorI18nKeys.AccessConfigure,
    });

    await user.click(getAction(ButtonsI18nKeys.Cancel));
    expect(screen.queryByText(UnsavedChangesI18nKeys.Title)).toBeNull();
  });

  it('asks before leaving after an Access entry is removed', async () => {
    renderKind(ACCESS_KIND, '?id=app-1');
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
      }),
    );

    await user.click(getAction(ButtonsI18nKeys.Cancel));

    expect(await screen.findByText(UnsavedChangesI18nKeys.Title)).toBeTruthy();
  });

  describe('saving an existing application', () => {
    const removeFilesEntry = async () => {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        }),
      );
    };

    it('sends nothing for Access when the section is untouched', async () => {
      renderKind(ACCESS_KIND, '?id=app-1');
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      });

      await user.click(getAction(ButtonsI18nKeys.Save));

      await screen.findByText('Catalog');
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(updateApplicationAccess).not.toHaveBeenCalled();
    });

    it('saves the definition first, then sends the changed list with the metadata, preserved entries kept', async () => {
      renderKind(ACCESS_KIND, '?id=app-1');
      await removeFilesEntry();

      await user.click(getAction(ButtonsI18nKeys.Save));

      await screen.findByText('Catalog');
      const [id, metadata, list] = vi.mocked(updateApplicationAccess).mock
        .calls[0];
      expect(id).toBe('app-1');
      expect(metadata).toEqual(expect.objectContaining({ name: 'Fake app' }));
      expect(list).toEqual([POLICIES]);
      expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(updateApplicationAccess).mock.invocationCallOrder[0],
      );
    });

    it('completes the save with a warning and keeps the draft when Core refuses', async () => {
      vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
      renderKind(ACCESS_KIND, '?id=app-1');
      await removeFilesEntry();

      await user.click(getAction(ButtonsI18nKeys.Save));

      await screen.findByText('Catalog');
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: AppsEditorI18nKeys.AccessAdminOnlyError,
          variant: NotificationVariant.Warning,
        }),
      );
    });

    it('aborts with exactly one error and keeps the editor open when the step fails otherwise', async () => {
      vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
      renderKind(ACCESS_KIND, '?id=app-1');
      await removeFilesEntry();

      await user.click(getAction(ButtonsI18nKeys.Save));

      await waitFor(() => expect(mockShowNotification).toHaveBeenCalledOnce());
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      );
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(screen.getByLabelText('fake-endpoint')).toBeTruthy();
    });
  });

  describe('creating an application', () => {
    const addPromptsEntry = async () => {
      await user.click(
        screen.getByRole('button', {
          name: AppsEditorI18nKeys.AccessConfigure,
        }),
      );
      const dialog = screen.getByRole('dialog');
      const [card] = within(dialog).getAllByRole('group');
      await user.click(
        within(card).getByRole('combobox', {
          name: AppsEditorI18nKeys.AccessSelectContent,
        }),
      );
      await user.click(
        await screen.findByRole('option', {
          name: AppsEditorI18nKeys.AccessContentPrompts,
        }),
      );
      await user.click(
        within(card).getByRole('combobox', {
          name: AppsEditorI18nKeys.AccessSelectAccess,
        }),
      );
      await user.click(
        await screen.findByRole('option', {
          name: AppsEditorI18nKeys.AccessRead,
        }),
      );
      await user.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.Save }),
      );
    };

    it('sends nothing for Access when the section is untouched', async () => {
      renderKind(ACCESS_KIND);
      await user.click(getAction(ButtonsI18nKeys.Create));
      await screen.findByText('Catalog');
      expect(updateApplicationAccess).not.toHaveBeenCalled();
    });

    it('runs the step against the created application after an all-at-once create', async () => {
      renderKind(ACCESS_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await screen.findByText('Catalog');
      expect(vi.mocked(updateApplicationAccess).mock.calls[0][0]).toBe(
        'new-id',
      );
      expect(vi.mocked(updateApplicationAccess).mock.calls[0][2]).toEqual([
        expect.objectContaining({ linkId: 'access-prompts' }),
      ]);
    });

    it('shows an error, keeps the draft and does not return when the create answers no id', async () => {
      mockCreate.mockResolvedValue({});
      renderKind(ACCESS_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await waitFor(() => expect(mockShowNotification).toHaveBeenCalled());
      expect(updateApplicationAccess).not.toHaveBeenCalled();
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(
        screen.getByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        }),
      ).toBeTruthy();
    });

    it('creates the application and returns with a warning when Core refuses the step', async () => {
      vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
      renderKind(ACCESS_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await screen.findByText('Catalog');
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: AppsEditorI18nKeys.AccessAdminOnlyError,
          variant: NotificationVariant.Warning,
        }),
      );
    });

    it('stays in edit mode for the created application, draft kept, when the step fails otherwise', async () => {
      vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
      const { router } = renderKind(ACCESS_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(router.state.location.search).toContain('id=new-id');
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(
        screen.getByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        }),
      ).toBeTruthy();
      expect(getApplicationResourceDependencies).not.toHaveBeenCalled();
    });

    it('keeps the editor open in edit mode with a warning and the draft after a metadata-first create when Core refuses', async () => {
      vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
      const { router } = renderKind(FIRST_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Warning }),
        ),
      );
      expect(router.state.location.search).toContain('id=new-id');
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(
        screen.getByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        }),
      ).toBeTruthy();
    });

    it('runs the step against the created id after a metadata-first create without leaving the editor', async () => {
      const { router } = renderKind(FIRST_KIND);
      await addPromptsEntry();

      await user.click(getAction(ButtonsI18nKeys.Create));

      await waitFor(() => expect(updateApplicationAccess).toHaveBeenCalled());
      expect(vi.mocked(updateApplicationAccess).mock.calls[0][0]).toBe(
        'new-id',
      );
      expect(router.state.location.search).toContain('id=new-id');
      expect(screen.queryByText('Catalog')).toBeNull();
      expect(
        screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
      ).toBeTruthy();
      fireEvent.blur(screen.getByLabelText('fake-endpoint'));
    });
  });

  describe('saving through the Save panel', () => {
    const removeFilesEntry = async () => {
      await user.click(
        await screen.findByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        }),
      );
    };
    const openPanel = async (action = ButtonsI18nKeys.Save) => {
      await user.click(getAction(action));
      await screen.findByRole('dialog', { name: 'save-panel' });
    };
    const accessOrder = () =>
      vi.mocked(updateApplicationAccess).mock.invocationCallOrder[0];

    let copySpy: ReturnType<typeof vi.spyOn>;
    let forkSpy: ReturnType<typeof vi.spyOn>;
    let commitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockPublish.mockResolvedValue(undefined);
      copySpy = vi
        .spyOn(publishApiClient, 'copyCatalogEntityToOrgUnit')
        .mockResolvedValue(undefined as never);
      forkSpy = vi
        .spyOn(applicationsApi, 'forkApplicationVersion')
        .mockResolvedValue({ id: 'applications/b/snapshot' });
      commitSpy = vi
        .spyOn(applicationsApi, 'commitApplicationVersion')
        .mockResolvedValue({ id: 'applications/b/app-v2' });
    });

    it('sends the changed list against the saved application, then returns', async () => {
      renderKind(PANEL_KIND, '?id=app-1');
      await removeFilesEntry();
      await openPanel();

      await user.click(screen.getByRole('button', { name: 'panel-save' }));

      await screen.findByText('Catalog');
      expect(updateApplicationAccess).toHaveBeenCalledOnce();
      const [id, , list] = vi.mocked(updateApplicationAccess).mock.calls[0];
      expect(id).toBe('app-1');
      expect(list).toEqual([POLICIES]);
      expect(mockUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        accessOrder(),
      );
    });

    it('sends the draft as it stands when the save is confirmed, even if it changed after the panel opened', async () => {
      renderKind(PANEL_KIND, '?id=app-1');
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      });
      await openPanel();
      await removeFilesEntry();

      await user.click(screen.getByRole('button', { name: 'panel-save' }));

      await screen.findByText('Catalog');
      expect(vi.mocked(updateApplicationAccess).mock.calls[0][2]).toEqual([
        POLICIES,
      ]);
    });

    it('sends nothing for Access and returns when the section is untouched', async () => {
      renderKind(PANEL_KIND, '?id=app-1');
      await screen.findByRole('button', {
        name: AppsEditorI18nKeys.AccessConfigure,
      });
      await openPanel();

      await user.click(screen.getByRole('button', { name: 'panel-save' }));

      await screen.findByText('Catalog');
      expect(updateApplicationAccess).not.toHaveBeenCalled();
    });

    it('writes the new version first, then sends the list against it with the new version as identity', async () => {
      mockCreate.mockResolvedValue({ id: 'applications/b/app-v2' });
      renderKind(PANEL_KIND, '?id=app-1');
      await removeFilesEntry();
      await openPanel();

      await user.click(
        screen.getByRole('button', { name: 'panel-save-new-version' }),
      );

      await screen.findByText('Catalog');
      const [id, metadata] = vi.mocked(updateApplicationAccess).mock.calls[0];
      expect(id).toBe('applications/b/app-v2');
      expect(metadata).toEqual(expect.objectContaining({ version: '2.0.0' }));
      expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(
        accessOrder(),
      );
    });

    it('sends the list to the source before the commit that moves the saved body into a new embedded version', async () => {
      renderKind(EMBEDDED_KIND, '?id=app-1');
      await removeFilesEntry();
      await openPanel();

      await user.click(
        screen.getByRole('button', { name: 'panel-save-new-version' }),
      );

      await screen.findByText('Catalog');
      expect(vi.mocked(updateApplicationAccess).mock.calls[0][0]).toBe('app-1');
      expect(forkSpy.mock.invocationCallOrder[0]).toBeLessThan(accessOrder());
      expect(accessOrder()).toBeLessThan(
        mockEmbeddedSave.mock.invocationCallOrder[0],
      );
      expect(mockEmbeddedSave.mock.invocationCallOrder[0]).toBeLessThan(
        commitSpy.mock.invocationCallOrder[0],
      );
    });

    it('sends the list before the publish request', async () => {
      renderKind(PANEL_KIND, '?id=app-1');
      await removeFilesEntry();
      await openPanel();

      await user.click(screen.getByRole('button', { name: 'panel-publish' }));

      await screen.findByText('Catalog');
      expect(mockPublish).toHaveBeenCalledOnce();
      expect(accessOrder()).toBeLessThan(
        mockPublish.mock.invocationCallOrder[0],
      );
    });

    it('sends the list before the direct write into an organisation unit', async () => {
      renderKind(PANEL_KIND, '?id=app-1');
      await removeFilesEntry();
      await openPanel();

      await user.click(
        screen.getByRole('button', { name: 'panel-write-to-org-unit' }),
      );

      await screen.findByText('Catalog');
      expect(copySpy).toHaveBeenCalledOnce();
      expect(accessOrder()).toBeLessThan(copySpy.mock.invocationCallOrder[0]);
    });

    describe('when Core refuses a non-administrator’s change', () => {
      beforeEach(() => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
      });

      const expectWarningOnly = () => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: AppsEditorI18nKeys.AccessAdminOnlyError,
            variant: NotificationVariant.Warning,
          }),
        );
        expect(
          mockShowNotification.mock.calls.filter(
            ([notification]) =>
              (notification as { variant: unknown }).variant ===
              NotificationVariant.Error,
          ),
        ).toHaveLength(0);
      };

      it('saves in place, shows the warning and returns', async () => {
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await screen.findByText('Catalog');
        expect(mockUpdate).toHaveBeenCalledOnce();
        expectWarningOnly();
      });

      it('still sends the publish request', async () => {
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(screen.getByRole('button', { name: 'panel-publish' }));

        await screen.findByText('Catalog');
        expect(mockPublish).toHaveBeenCalledOnce();
        expectWarningOnly();
      });

      it('still writes into the organisation unit', async () => {
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(
          screen.getByRole('button', { name: 'panel-write-to-org-unit' }),
        );

        await screen.findByText('Catalog');
        expect(copySpy).toHaveBeenCalledOnce();
        expectWarningOnly();
      });

      it('still runs the embedded editor save', async () => {
        renderKind(EMBEDDED_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await screen.findByText('Catalog');
        expect(mockEmbeddedSave).toHaveBeenCalledOnce();
        expectWarningOnly();
      });

      it('still forks, saves and commits a new embedded version', async () => {
        renderKind(EMBEDDED_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(
          screen.getByRole('button', { name: 'panel-save-new-version' }),
        );

        await screen.findByText('Catalog');
        expect(forkSpy).toHaveBeenCalledOnce();
        expect(mockEmbeddedSave).toHaveBeenCalledOnce();
        expect(commitSpy).toHaveBeenCalledOnce();
        expectWarningOnly();
      });

      it('still creates the new version of a host-written application', async () => {
        mockCreate.mockResolvedValue({ id: 'applications/b/app-v2' });
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(
          screen.getByRole('button', { name: 'panel-save-new-version' }),
        );

        await screen.findByText('Catalog');
        expect(mockCreate).toHaveBeenCalledOnce();
        expectWarningOnly();
      });
    });

    describe('when the step fails for another reason', () => {
      it('aborts the save with one message in the panel, no toast and no publish', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(screen.getByRole('button', { name: 'panel-publish' }));

        expect(
          await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed),
        ).toBeTruthy();
        expect(mockShowNotification).not.toHaveBeenCalled();
        expect(mockPublish).not.toHaveBeenCalled();
        expect(screen.queryByText('Catalog')).toBeNull();
      });

      it('keeps the panel open and the draft, so the author can retry', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValueOnce(serverError());
        renderKind(PANEL_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();
        await user.click(screen.getByRole('button', { name: 'panel-save' }));
        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await screen.findByText('Catalog');
        expect(updateApplicationAccess).toHaveBeenCalledTimes(2);
      });

      it('writes nothing through the embedded editor when the step fails', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
        renderKind(EMBEDDED_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);
        expect(mockEmbeddedSave).not.toHaveBeenCalled();
      });

      it('deletes the fork of a new embedded version and does not commit', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
        const deleteSpy = vi
          .spyOn(applicationsApi, 'deleteApplication')
          .mockResolvedValue(undefined);
        renderKind(EMBEDDED_KIND, '?id=app-1');
        await removeFilesEntry();
        await openPanel();

        await user.click(
          screen.getByRole('button', { name: 'panel-save-new-version' }),
        );

        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);
        expect(mockEmbeddedSave).not.toHaveBeenCalled();
        expect(commitSpy).not.toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalled();
      });
    });

    describe('creating a metadata-first application', () => {
      const addPromptsEntry = async () => {
        await user.click(
          screen.getByRole('button', {
            name: AppsEditorI18nKeys.AccessConfigure,
          }),
        );
        const dialog = screen.getByRole('dialog');
        const [card] = within(dialog).getAllByRole('group');
        await user.click(
          within(card).getByRole('combobox', {
            name: AppsEditorI18nKeys.AccessSelectContent,
          }),
        );
        await user.click(
          await screen.findByRole('option', {
            name: AppsEditorI18nKeys.AccessContentPrompts,
          }),
        );
        await user.click(
          within(card).getByRole('combobox', {
            name: AppsEditorI18nKeys.AccessSelectAccess,
          }),
        );
        await user.click(
          await screen.findByRole('option', {
            name: AppsEditorI18nKeys.AccessRead,
          }),
        );
        await user.click(
          within(dialog).getByRole('button', { name: ButtonsI18nKeys.Save }),
        );
      };

      it('creates the application and switches to edit mode with the warning and the draft when Core refuses', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(refusal());
        const { router } = renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await waitFor(() =>
          expect(router.state.location.search).toContain('id=new-id'),
        );
        expect(mockCreate).toHaveBeenCalledOnce();
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Warning }),
        );
        expect(screen.queryByText('Catalog')).toBeNull();
        expect(
          screen.getByRole('button', {
            name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
          }),
        ).toBeTruthy();
      });

      it('sends the list against the created application inside the create, then switches to edit mode', async () => {
        const { router } = renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await waitFor(() =>
          expect(router.state.location.search).toContain('id=new-id'),
        );
        expect(vi.mocked(updateApplicationAccess).mock.calls[0][0]).toBe(
          'new-id',
        );
        expect(mockCreate.mock.invocationCallOrder[0]).toBeLessThan(
          accessOrder(),
        );
        expect(screen.queryByText('Catalog')).toBeNull();
      });

      it('keeps the panel open with one specific message and the draft when the step fails', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
        const { router } = renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        expect(
          await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed),
        ).toBeTruthy();
        expect(mockShowNotification).not.toHaveBeenCalled();
        expect(router.state.location.search).not.toContain('id=');
      });

      it('puts the editor in edit mode for the created application, draft kept, when the panel is closed after a failure', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValue(serverError());
        const { router } = renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);
        await user.click(screen.getByRole('button', { name: 'panel-save' }));
        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);

        await user.click(screen.getByRole('button', { name: 'panel-close' }));

        await waitFor(() =>
          expect(router.state.location.search).toContain('id=new-id'),
        );
        expect(
          screen.getByRole('button', {
            name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
          }),
        ).toBeTruthy();
        expect(screen.queryByText('Catalog')).toBeNull();
      });

      it('saves through the update path, without creating again, when the author saves after closing the panel', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValueOnce(serverError());
        renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);
        await user.click(screen.getByRole('button', { name: 'panel-save' }));
        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);
        await user.click(screen.getByRole('button', { name: 'panel-close' }));
        await screen.findByRole('button', {
          name: new RegExp(AppsEditorI18nKeys.AccessRemoveEntry),
        });

        await openPanel(ButtonsI18nKeys.Save);
        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await screen.findByText('Catalog');
        expect(mockCreate).toHaveBeenCalledOnce();
        expect(mockUpdate).toHaveBeenCalledOnce();
        expect(updateApplicationAccess).toHaveBeenCalledTimes(2);
        expect(vi.mocked(updateApplicationAccess).mock.calls[1][0]).toBe(
          'new-id',
        );
      });

      it('reuses the application an earlier attempt created when the author retries in the same folder', async () => {
        vi.mocked(updateApplicationAccess).mockRejectedValueOnce(serverError());
        renderKind(PANEL_FIRST_KIND);
        await addPromptsEntry();
        await openPanel(ButtonsI18nKeys.Create);
        await user.click(screen.getByRole('button', { name: 'panel-save' }));
        await screen.findByText(CustomAppI18nKeys.ErrorSaveFailed);

        await user.click(screen.getByRole('button', { name: 'panel-save' }));

        await waitFor(() =>
          expect(updateApplicationAccess).toHaveBeenCalledTimes(2),
        );
        expect(mockCreate).toHaveBeenCalledOnce();
      });
    });
  });
});
