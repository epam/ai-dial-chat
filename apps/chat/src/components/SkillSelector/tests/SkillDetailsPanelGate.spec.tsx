import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkillDetailsPanelGate from '../SkillDetailsPanelGate';

const mocks = vi.hoisted(() => ({ isAfterLoadIdle: false }));

vi.mock('../../../hooks/useIsAfterLoadIdle', () => ({
  useIsAfterLoadIdle: () => mocks.isAfterLoadIdle,
}));
vi.mock('../SkillDetailsPanelContainer', () => ({
  default: ({ skillId }: { skillId: string | null }) => (
    <p>{skillId ? `details of ${skillId}` : 'details closed'}</p>
  ),
}));

const renderGate = (skillId: string | null) =>
  render(
    <Suspense fallback={null}>
      <SkillDetailsPanelGate skillId={skillId} onClose={vi.fn()} />
    </Suspense>,
  );

describe('SkillDetailsPanelGate', () => {
  beforeEach(() => {
    mocks.isAfterLoadIdle = false;
  });

  it('mounts nothing while the page loads and no skill is open', () => {
    renderGate(null);

    expect(screen.queryByText(/details/)).toBeNull();
  });

  it('mounts the panel when a skill opens before the page has loaded', async () => {
    renderGate('skills/bucket/skill-1');

    expect(
      await screen.findByText('details of skills/bucket/skill-1'),
    ).toBeTruthy();
  });

  it('mounts the closed panel once the page has loaded', async () => {
    mocks.isAfterLoadIdle = true;
    renderGate(null);

    expect(await screen.findByText('details closed')).toBeTruthy();
  });
});
