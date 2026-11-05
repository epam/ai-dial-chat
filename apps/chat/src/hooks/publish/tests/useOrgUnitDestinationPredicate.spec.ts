import { SaveDestinationRoot } from '@epam/ai-dial-chat-hooks';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrgUnitsContext } from '../../../context/OrgUnitsContext';
import { useOrgUnitDestinationPredicate } from '../useOrgUnitDestinationPredicate';

vi.mock('../../../context/OrgUnitsContext', () => ({
  useOrgUnitsContext: vi.fn(),
}));

describe('useOrgUnitDestinationPredicate', () => {
  const ensureUnits = vi.fn();
  const isOrgUnitFolder = vi.fn((path: string) => path === 'Acme/Risk');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrgUnitsContext).mockReturnValue({
      ensureUnits,
      isOrgUnitFolder,
    } as unknown as ReturnType<typeof useOrgUnitsContext>);
  });

  it('does not read the units while the panel is closed', () => {
    renderHook(() => useOrgUnitDestinationPredicate(false));

    expect(ensureUnits).not.toHaveBeenCalled();
  });

  it('starts the shared read once the panel opens', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useOrgUnitDestinationPredicate(isOpen),
      { initialProps: { isOpen: false } },
    );

    rerender({ isOpen: true });

    expect(ensureUnits).toHaveBeenCalledOnce();
  });

  it('matches a public-bucket folder by its joined path', () => {
    const { result } = renderHook(() => useOrgUnitDestinationPredicate(true));

    expect(result.current.isOrgUnitDestination(['Acme', 'Risk'])).toBe(true);
    expect(result.current.isOrgUnitDestination([])).toBe(false);
  });

  it('matches only folders of the Organization root in a save tree', () => {
    const { result } = renderHook(() => useOrgUnitDestinationPredicate(true));

    expect(
      result.current.isOrgUnitDestinationInRoot(
        ['Acme', 'Risk'],
        SaveDestinationRoot.Organization,
      ),
    ).toBe(true);
    expect(
      result.current.isOrgUnitDestinationInRoot(
        ['Acme', 'Risk'],
        SaveDestinationRoot.Personal,
      ),
    ).toBe(false);
  });
});
