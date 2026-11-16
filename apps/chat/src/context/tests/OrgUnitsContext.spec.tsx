import { OrgUnitsStatus } from '@epam/ai-dial-chat-hooks';
import { render, renderHook, screen } from '@testing-library/react';
import { useEffect, type FC } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listOrgUnits } from '../../server-api/org-units.api';
import { useFeatureFlag } from '../AppConfigContext';
import { OrgUnitsProvider, useOrgUnitsContext } from '../OrgUnitsContext';

vi.mock('../../server-api/org-units.api', () => ({
  listOrgUnits: vi.fn(),
}));

vi.mock('../AppConfigContext', () => ({
  useFeatureFlag: vi.fn(),
}));

const Consumer: FC<{ name: string }> = ({ name }) => {
  const { ensureUnits, status } = useOrgUnitsContext();
  useEffect(() => ensureUnits(), [ensureUnits]);
  return <span>{`${name}: ${status}`}</span>;
};

describe('OrgUnitsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOrgUnits).mockResolvedValue({ enabled: true, units: [] });
    vi.mocked(useFeatureFlag).mockImplementation(
      (key) => key === 'orgUnitsEnabled',
    );
  });

  it('does not read the units until a consumer asks for them', () => {
    render(
      <OrgUnitsProvider>
        <span>no consumer</span>
      </OrgUnitsProvider>,
    );

    expect(listOrgUnits).not.toHaveBeenCalled();
  });

  it('serves two consumers from one read', async () => {
    render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
        <Consumer name="publish panel" />
      </OrgUnitsProvider>,
    );

    expect(
      await screen.findByText(`publish panel: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`file manager: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('never reads the units while the orgUnitsEnabled flag is off', () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    expect(listOrgUnits).not.toHaveBeenCalled();
    expect(
      screen.getByText(`file manager: ${OrgUnitsStatus.Idle}`),
    ).toBeTruthy();
  });

  it('starts the read for an already mounted consumer once the flag turns on', async () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);
    const { rerender } = render(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    vi.mocked(useFeatureFlag).mockReturnValue(true);
    rerender(
      <OrgUnitsProvider>
        <Consumer name="file manager" />
      </OrgUnitsProvider>,
    );

    expect(
      await screen.findByText(`file manager: ${OrgUnitsStatus.Ready}`),
    ).toBeTruthy();
    expect(listOrgUnits).toHaveBeenCalledOnce();
  });

  it('throws a clear error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useOrgUnitsContext())).toThrow(
      'useOrgUnitsContext must be used within an OrgUnitsProvider',
    );
  });
});
