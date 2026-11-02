import {
  CatalogCreationType,
  type CatalogCreationPermissionsDto,
} from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../../context/AppConfigContext';
import { UserConfigStatus } from '../../../types/user-config-status';
import { useCatalogCreationPermissions } from '../useCatalogCreationPermissions';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const ALL_TYPES = Object.values(CatalogCreationType);

const mockCreationState = (
  catalogCreationStatus: UserConfigStatus,
  catalogCreationPermissions: CatalogCreationPermissionsDto | null,
) =>
  vi.mocked(useAppConfig).mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: {} as never,
    catalogCreationStatus,
    catalogCreationPermissions,
  });

describe('useCatalogCreationPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([UserConfigStatus.Loading, UserConfigStatus.Error])(
    'denies every type and schema while the status is %s',
    (status) => {
      mockCreationState(status, null);
      const { result } = renderHook(() => useCatalogCreationPermissions());

      expect(result.current.status).toBe(status);
      for (const type of ALL_TYPES) {
        expect(result.current.canCreateType(type)).toBe(false);
      }
      expect(result.current.canCreateSchema('schema-A')).toBe(false);
    },
  );

  it('ignores permissions that are not marked ready', () => {
    mockCreationState(UserConfigStatus.Loading, {
      allowedTypes: ALL_TYPES,
      restrictedSchemaIds: [],
    });
    const { result } = renderHook(() => useCatalogCreationPermissions());

    expect(result.current.canCreateType(CatalogCreationType.Skill)).toBe(false);
  });

  it('allows exactly the reported types once ready', () => {
    mockCreationState(UserConfigStatus.Ready, {
      allowedTypes: [CatalogCreationType.Prompt, CatalogCreationType.Skill],
      restrictedSchemaIds: [],
    });
    const { result } = renderHook(() => useCatalogCreationPermissions());

    expect(result.current.status).toBe(UserConfigStatus.Ready);
    expect(result.current.canCreateType(CatalogCreationType.Prompt)).toBe(true);
    expect(result.current.canCreateType(CatalogCreationType.Skill)).toBe(true);
    expect(result.current.canCreateType(CatalogCreationType.CustomApp)).toBe(
      false,
    );
    expect(result.current.canCreateType(CatalogCreationType.Toolset)).toBe(
      false,
    );
  });

  it('allows a schema only when schema-app is allowed and the id is not restricted', () => {
    mockCreationState(UserConfigStatus.Ready, {
      allowedTypes: ALL_TYPES,
      restrictedSchemaIds: ['schema-A'],
    });
    const { result } = renderHook(() => useCatalogCreationPermissions());

    expect(result.current.canCreateSchema('schema-A')).toBe(false);
    expect(result.current.canCreateSchema('schema-B')).toBe(true);
  });

  it('denies every schema when the schema-app type is denied', () => {
    mockCreationState(UserConfigStatus.Ready, {
      allowedTypes: [CatalogCreationType.CustomApp],
      restrictedSchemaIds: [],
    });
    const { result } = renderHook(() => useCatalogCreationPermissions());

    expect(result.current.canCreateSchema('schema-B')).toBe(false);
    expect(result.current.canCreateType(CatalogCreationType.CustomApp)).toBe(
      true,
    );
  });

  it('matches schema ids exactly', () => {
    mockCreationState(UserConfigStatus.Ready, {
      allowedTypes: ALL_TYPES,
      restrictedSchemaIds: ['https://example.test/schemas/Runner-A'],
    });
    const { result } = renderHook(() => useCatalogCreationPermissions());

    expect(
      result.current.canCreateSchema('https://example.test/schemas/Runner-A'),
    ).toBe(false);
    expect(
      result.current.canCreateSchema('https://example.test/schemas/runner-a'),
    ).toBe(true);
    expect(result.current.canCreateSchema('Runner-A')).toBe(true);
  });

  it('keeps its callbacks stable while the permissions are unchanged', () => {
    const permissions = {
      allowedTypes: ALL_TYPES,
      restrictedSchemaIds: ['schema-A'],
    };
    mockCreationState(UserConfigStatus.Ready, permissions);
    const { result, rerender } = renderHook(() =>
      useCatalogCreationPermissions(),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('updates its decisions when the permissions change', () => {
    mockCreationState(UserConfigStatus.Ready, {
      allowedTypes: ALL_TYPES,
      restrictedSchemaIds: [],
    });
    const { result, rerender } = renderHook(() =>
      useCatalogCreationPermissions(),
    );
    const { canCreateType: before } = result.current;

    mockCreationState(UserConfigStatus.Loading, null);
    rerender();

    expect(result.current.canCreateType).not.toBe(before);
    expect(result.current.canCreateType(CatalogCreationType.Prompt)).toBe(
      false,
    );
  });
});
