import { CatalogCreationType } from '@epam/ai-dial-chat-api-client';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import {
  resetCatalogCreationState,
  setCatalogCreationState,
} from '../../../context/tests/catalog-creation-state';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
import type {
  ApplicationEditorDefinition,
  ApplicationSetupProps,
} from '../../../models/application-editor';
import {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../../../types/application-editor';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import {
  defineApplicationEditor,
  isApplicationEditorPageDefinition,
} from '../../../utils/application-editor';
import ApplicationEditorPage from '../ApplicationEditorPage';

interface FakeSetup {
  endpoint: string;
}

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockShowNotification = vi.fn();
const mockRefetchDeployments = vi.fn();
const mockNotifyOperationSuccess = vi.fn();

/* A kind that exists only in this test: one Setup field and a mocked create. */
const { FAKE_KIND } = vi.hoisted(() => ({
  FAKE_KIND: 'fake-kind' as ApplicationEditorKind,
}));

const FakeSetupForm = ({
  value,
  errors,
  onChange,
}: ApplicationSetupProps<FakeSetup>) => (
  <label>
    fake-endpoint
    <input
      value={value.endpoint}
      onChange={(event) => onChange({ endpoint: event.target.value })}
    />
    {errors.endpoint && <span>{errors.endpoint}</span>}
  </label>
);

const fakeDefinition = defineApplicationEditor<FakeSetup>({
  kind: FAKE_KIND,
  creationType: CatalogCreationType.CustomApp,
  notifiableEntity: NotifiableEntity.CustomApp,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
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
    name: '',
    description: '',
    iconUrl: '',
    version: '',
    topics: [],
    otherLocales: [],
  },
  defaultSetup: { endpoint: '' },
  validateSetup: (setup) =>
    setup.endpoint ? {} : { endpoint: 'fake.endpointRequired' },
  Setup: FakeSetupForm,
  create: mockCreate,
  update: mockUpdate,
});

vi.mock('../../../context/AppConfigContext', async () => {
  const { useCatalogCreationState } =
    await import('../../../context/tests/catalog-creation-state');
  return {
    useAppConfig: () => ({
      status: 'ready',
      config: {},
      ...useCatalogCreationState(),
    }),
  };
});
vi.mock('../definitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../definitions')>();
  return {
    APPLICATION_EDITOR_DEFINITIONS: {
      ...actual.APPLICATION_EDITOR_DEFINITIONS,
      // Read lazily: the mock factory is hoisted above the definition.
      get [FAKE_KIND]() {
        return fakeDefinition;
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
    items: [],
    refetchDeployments: mockRefetchDeployments,
    isLoading: false,
  }),
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

const renderFakeKind = () =>
  renderWithLeaveGuard(
    <Routes>
      <Route
        path="/fake-editor"
        element={<ApplicationEditorPage kind={FAKE_KIND} />}
      />
      <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
    </Routes>,
    ['/fake-editor'],
  );

/* The layout renders its actions in the header and again in the mobile bar; take the header copy. */
const getAction = (name: string) => screen.getAllByRole('button', { name })[0];

describe('ApplicationEditorPage', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    resetCatalogCreationState();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    mockCreate.mockResolvedValue({ id: 'new-id' });
    mockRefetchDeployments.mockResolvedValue(undefined);
  });

  it('renders a kind registered with only a definition inside the shared layout', () => {
    renderFakeKind();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: CustomAppI18nKeys.CreateTitle,
      }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
    ).toBeTruthy();
    expect(screen.getByLabelText('fake-endpoint')).toBeTruthy();
  });

  it("checks a new application against its kind's creation type", () => {
    setCatalogCreationState({
      allowedTypes: Object.values(CatalogCreationType).filter(
        (type) => type !== CatalogCreationType.CustomApp,
      ),
      restrictedSchemaIds: [],
    });
    renderFakeKind();

    expect(screen.getByRole('alert').textContent).toBe(
      CatalogI18nKeys.CreationDenied,
    );
    expect(screen.queryByLabelText('fake-endpoint')).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the fake kind with its metadata and setup, confirms it and returns', async () => {
    renderFakeKind();

    await user.type(
      screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
      'Fake app',
    );
    await user.type(screen.getByLabelText('fake-endpoint'), 'https://x.test');
    await user.click(getAction(ButtonsI18nKeys.Create));

    await screen.findByText('Catalog');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fake app' }),
      { endpoint: 'https://x.test' },
      expect.objectContaining({ searchParams: expect.any(URLSearchParams) }),
    );
    expect(mockNotifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.CustomApp,
      EntityOperation.Created,
      { name: 'Fake app' },
    );
  });

  it('keeps the primary button enabled and blocks the request when metadata is invalid', async () => {
    renderFakeKind();

    const createButton = getAction(ButtonsI18nKeys.Create) as HTMLButtonElement;
    expect(createButton.disabled).toBe(false);

    await user.click(createButton);

    expect(screen.getByText(EditorI18nKeys.NameRequired)).toBeTruthy();
    expect(
      screen
        .getByLabelText(EditorI18nKeys.NameLabel, { exact: false })
        .matches(':focus'),
    ).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows the Setup errors the definition returns and sends no request', async () => {
    renderFakeKind();

    await user.type(
      screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
      'Fake app',
    );
    await user.click(getAction(ButtonsI18nKeys.Create));

    expect(screen.getByText('fake.endpointRequired')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('raises the generic create-failed notification when the API gives no message', async () => {
    mockCreate.mockRejectedValue(new Error(''));
    renderFakeKind();

    await user.type(
      screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
      'Fake app',
    );
    await user.type(screen.getByLabelText('fake-endpoint'), 'https://x.test');
    await user.click(getAction(ButtonsI18nKeys.Create));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: NotificationVariant.Error,
          message: CustomAppI18nKeys.ErrorCreateFailed,
        }),
      ),
    );
    expect(screen.queryByText('Catalog')).toBeNull();
  });
});

describe('ApplicationEditorPage Metadata column resizing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  const getHandle = () =>
    screen.getByRole('separator', {
      name: EditorI18nKeys.ResizeHandleAriaLabel,
    });

  it('opens at the default width', () => {
    renderFakeKind();

    expect(getHandle().getAttribute('aria-valuenow')).toBe('400');
  });

  it('does not restore a width stored by an earlier visit', () => {
    localStorage.setItem('applicationEditorMetadataWidth', JSON.stringify(520));

    renderFakeKind();

    expect(getHandle().getAttribute('aria-valuenow')).toBe('400');
  });

  it('sends the same create payload after the column was resized', async () => {
    mockCreate.mockResolvedValue({ id: 'new-id' });
    renderFakeKind();

    fireEvent.keyDown(getHandle(), { key: 'End' });
    await userEvent.type(
      screen.getByLabelText(EditorI18nKeys.NameLabel, { exact: false }),
      'Fake app',
    );
    await userEvent.type(
      screen.getByLabelText('fake-endpoint'),
      'https://x.test',
    );
    await userEvent.click(getAction(ButtonsI18nKeys.Create));

    await screen.findByText('Catalog');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fake app' }),
      { endpoint: 'https://x.test' },
      expect.objectContaining({ searchParams: expect.any(URLSearchParams) }),
    );
  });

  it('applies the width chosen with the keyboard without persisting it', () => {
    renderFakeKind();

    fireEvent.keyDown(getHandle(), { key: 'ArrowRight' });

    expect(getHandle().getAttribute('aria-valuenow')).toBe('416');
    expect(localStorage.length).toBe(0);
  });

  it('opens at the default width again after remounting the editor', () => {
    const { unmount } = renderFakeKind();
    fireEvent.keyDown(getHandle(), { key: 'End' });
    unmount();

    renderFakeKind();

    expect(getHandle().getAttribute('aria-valuenow')).toBe('400');
  });
});

describe('APPLICATION_EDITOR_DEFINITIONS', () => {
  it('registers every kind, with only the toolset rendering its own page', async () => {
    const { APPLICATION_EDITOR_DEFINITIONS } =
      await vi.importActual<typeof import('../definitions')>('../definitions');
    const definitions = APPLICATION_EDITOR_DEFINITIONS as Partial<
      Record<ApplicationEditorKind, ApplicationEditorDefinition>
    >;

    const toolset = definitions[ApplicationEditorKind.Toolset];
    const customApp = definitions[ApplicationEditorKind.CustomApp];
    const quickApp = definitions[ApplicationEditorKind.QuickApp];

    expect(toolset && isApplicationEditorPageDefinition(toolset)).toBe(true);
    expect(customApp && isApplicationEditorPageDefinition(customApp)).toBe(
      false,
    );
    expect(quickApp && isApplicationEditorPageDefinition(quickApp)).toBe(false);
  });

  it('checks each kind against its own creation type', async () => {
    const { APPLICATION_EDITOR_DEFINITIONS } =
      await vi.importActual<typeof import('../definitions')>('../definitions');

    expect(
      Object.fromEntries(
        Object.entries(APPLICATION_EDITOR_DEFINITIONS).map(
          ([kind, definition]) => [kind, definition.creationType],
        ),
      ),
    ).toEqual({
      [ApplicationEditorKind.Toolset]: CatalogCreationType.Toolset,
      [ApplicationEditorKind.CustomApp]: CatalogCreationType.CustomApp,
      [ApplicationEditorKind.QuickApp]: CatalogCreationType.SchemaApp,
      [ApplicationEditorKind.SchemaApp]: CatalogCreationType.SchemaApp,
    });
  });

  it('opens every form-based kind with an empty name and version 1.0.0', async () => {
    const { APPLICATION_EDITOR_DEFINITIONS } =
      await vi.importActual<typeof import('../definitions')>('../definitions');
    const definitions = APPLICATION_EDITOR_DEFINITIONS as Partial<
      Record<ApplicationEditorKind, ApplicationEditorDefinition>
    >;

    for (const kind of [
      ApplicationEditorKind.CustomApp,
      ApplicationEditorKind.QuickApp,
      ApplicationEditorKind.SchemaApp,
    ]) {
      const definition = definitions[kind];
      if (!definition || isApplicationEditorPageDefinition(definition)) {
        throw new Error(`${kind} is not a form-based definition`);
      }
      expect(definition.defaultMetadata).toMatchObject({
        name: '',
        version: '1.0.0',
      });
    }
  });
});
