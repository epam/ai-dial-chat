import {
  CatalogCreationType,
  type CatalogCreationPermissionsDto,
} from '@epam/ai-dial-chat-api-client';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import { useAppConfig } from '../../../context/AppConfigContext';
import { ROUTES } from '../../../types/routes';
import { UserConfigStatus } from '../../../types/user-config-status';
import RequireCatalogCreation from '../RequireCatalogCreation';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const ALL_TYPES = Object.values(CatalogCreationType);

const mockCreation = (
  catalogCreationStatus: UserConfigStatus,
  catalogCreationPermissions: CatalogCreationPermissionsDto | null = null,
) =>
  vi.mocked(useAppConfig).mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: {} as never,
    catalogCreationStatus,
    catalogCreationPermissions,
  });

const allow = (
  allowedTypes: CatalogCreationType[] = ALL_TYPES,
  restrictedSchemaIds: string[] = [],
) =>
  mockCreation(UserConfigStatus.Ready, { allowedTypes, restrictedSchemaIds });

/* Stands in for a create form; mounting it would start the form's effects. */
const onFormMount = vi.fn();
const CreateForm = () => {
  useEffect(() => {
    onFormMount();
  }, []);
  return <form aria-label="Create form" />;
};

const boundaryTree = (
  props: Partial<Parameters<typeof RequireCatalogCreation>[0]> = {},
  children: ReactNode = <CreateForm />,
) => (
  <MemoryRouter initialEntries={['/editor']}>
    <Routes>
      <Route
        path="/editor"
        element={
          <RequireCatalogCreation
            isCreateMode
            type={CatalogCreationType.Prompt}
            {...props}
          >
            {children}
          </RequireCatalogCreation>
        }
      />
      <Route path={ROUTES.Catalog} element={<main>Catalog page</main>} />
    </Routes>
  </MemoryRouter>
);

const renderBoundary = (
  props: Partial<Parameters<typeof RequireCatalogCreation>[0]> = {},
  children?: ReactNode,
) => render(boundaryTree(props, children));

describe('RequireCatalogCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the create form once creation is allowed', () => {
    allow();
    renderBoundary();

    expect(screen.getByRole('form', { name: 'Create form' })).toBeTruthy();
    expect(onFormMount).toHaveBeenCalledOnce();
  });

  it('announces a pending check through one status region without mounting the form', () => {
    mockCreation(UserConfigStatus.Loading);
    renderBoundary();

    const [status] = screen.getAllByRole('status');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(
      within(status).getByRole('img', {
        name: CatalogI18nKeys.CreationLoading,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    expect(onFormMount).not.toHaveBeenCalled();
  });

  it('keeps the check pending while the host is still resolving', () => {
    allow();
    renderBoundary({ isPending: true });

    expect(
      within(screen.getByRole('status')).getByRole('img', {
        name: CatalogI18nKeys.CreationLoading,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('shows the unavailable screen when permissions failed to load', () => {
    mockCreation(UserConfigStatus.Error);
    renderBoundary();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: CatalogI18nKeys.CreationUnavailable,
      }),
    ).toBeTruthy();
    expect(onFormMount).not.toHaveBeenCalled();
  });

  it('shows the unavailable screen when the host cannot resolve the request', () => {
    allow();
    renderBoundary({ isUnavailable: true });

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: CatalogI18nKeys.CreationUnavailable,
      }),
    ).toBeTruthy();
  });

  it('shows the denied screen for a denied type', () => {
    allow(ALL_TYPES.filter((type) => type !== CatalogCreationType.Prompt));
    renderBoundary();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: CatalogI18nKeys.CreationDenied,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(onFormMount).not.toHaveBeenCalled();
  });

  it('renders the denied state as a region named by its message, not as an alert', () => {
    allow([]);
    renderBoundary();

    expect(
      screen.getByRole('region', { name: CatalogI18nKeys.CreationDenied }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps a mounted create form when permissions later reload or are lost', () => {
    allow();
    const { rerender } = renderBoundary();

    mockCreation(UserConfigStatus.Loading);
    rerender(boundaryTree());
    allow([]);
    rerender(boundaryTree());

    expect(screen.getByRole('form', { name: 'Create form' })).toBeTruthy();
    expect(onFormMount).toHaveBeenCalledOnce();
  });

  it('renders the editor in edit mode even when creation is denied', () => {
    allow([]);
    renderBoundary({ isCreateMode: false });

    expect(screen.getByRole('form', { name: 'Create form' })).toBeTruthy();
  });

  it('renders the editor in edit mode while permissions are still loading', () => {
    mockCreation(UserConfigStatus.Loading);
    renderBoundary({ isCreateMode: false });

    expect(screen.getByRole('form', { name: 'Create form' })).toBeTruthy();
  });

  describe('schema apps', () => {
    const schemaApp = { type: CatalogCreationType.SchemaApp };

    it('allows a schema that is not restricted', () => {
      allow(ALL_TYPES, ['schema-A']);
      renderBoundary({ ...schemaApp, schemaId: 'schema-B' });

      expect(screen.getByRole('form')).toBeTruthy();
    });

    it('denies an exactly restricted schema', () => {
      allow(ALL_TYPES, ['schema-A']);
      renderBoundary({ ...schemaApp, schemaId: 'schema-A' });

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: CatalogI18nKeys.CreationDenied,
        }),
      ).toBeTruthy();
    });

    it('denies every schema when the schema-app type is denied', () => {
      allow([CatalogCreationType.CustomApp]);
      renderBoundary({ ...schemaApp, schemaId: 'schema-B' });

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: CatalogI18nKeys.CreationDenied,
        }),
      ).toBeTruthy();
    });

    it.each([undefined, null, ''])(
      'treats a missing schema id %j as unavailable, never as allowed',
      (schemaId) => {
        allow();
        renderBoundary({ ...schemaApp, schemaId });

        expect(
          screen.getByRole('heading', {
            level: 1,
            name: CatalogI18nKeys.CreationUnavailable,
          }),
        ).toBeTruthy();
        expect(screen.queryByRole('form')).toBeNull();
      },
    );
  });

  describe('back action', () => {
    it('returns to the catalog by keyboard', async () => {
      const user = userEvent.setup({ delay: null });
      allow([]);
      renderBoundary();

      const back = screen.getByRole('button', {
        name: EditorI18nKeys.BackAriaLabel,
      });
      await user.tab();
      expect(back.matches(':focus')).toBe(true);
      await user.keyboard('{Enter}');

      expect(screen.getByRole('main').textContent).toBe('Catalog page');
    });

    it('mirrors the back arrow in right-to-left layouts', () => {
      allow([]);
      renderBoundary();

      const icon = screen
        .getByRole('button', { name: EditorI18nKeys.BackAriaLabel })
        // eslint-disable-next-line testing-library/no-node-access -- the icon has no role; its mirroring class is what is under test
        .querySelector('svg');
      expect(icon?.getAttribute('class')).toContain('rtl:scale-x-[-1]');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
