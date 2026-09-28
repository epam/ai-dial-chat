import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelebrationDecor } from '../../components/CelebrationDecor/CelebrationDecor';
import type {
  CelebrationEvent,
  CelebrationEventSelection,
} from '../../models/celebration';
import { CelebrationProvider, useCelebration } from '../CelebrationContext';
import { useDecorBehavior } from '../CelebrationEnvironmentContext';

const onNotify = vi.fn();
let consumed: boolean | null = null;

const BehaviorProbe = ({ behavior }: { behavior: string }) => (
  <span data-testid={`behavior-${behavior}`}>
    {String(useDecorBehavior(behavior))}
  </span>
);

const EVENT: CelebrationEvent = {
  id: 'party',
  Decoration: () => (
    <>
      <BehaviorProbe behavior="sparkle" />
      <BehaviorProbe behavior="dance" />
    </>
  ),
  scenes: ['ghosts', 'bats', 'cat', 'spiders'].map((id) => ({
    id,
    Component: () => <span data-testid={`scene-${id}`} />,
    durationMs: 1000,
    labelId: id,
  })),
  clickSceneIds: ['ghosts', 'bats', 'cat'],
  labels: { title: 'Party', ghosts: 'g', bats: 'b', cat: 'c', spiders: 's' },
  titleLabelId: 'title',
  decorBehaviors: ['sparkle', 'dance'],
  secretTrigger: {
    phrases: ['open sesame'],
    hintPhrase: 'open sesame',
    sceneIds: ['spiders', 'cat'],
  },
};

const Triggers = () => {
  const { isEnabled, activate, celebrate, consumeSecretPhrase } =
    useCelebration();
  return (
    <>
      <span data-testid="enabled">{String(isEnabled)}</span>
      <button type="button" onClick={activate}>
        activate
      </button>
      <button type="button" onClick={() => celebrate('cat')}>
        cat
      </button>
      <button
        type="button"
        onClick={() => {
          consumed = consumeSecretPhrase('Open, sesame!');
        }}
      >
        secret
      </button>
    </>
  );
};

const renderWith = async (selection?: CelebrationEventSelection) => {
  render(
    <CelebrationProvider
      events={{ party: async () => EVENT }}
      activeEventId="party"
      onNotify={onNotify}
      selection={selection ? { party: selection } : undefined}
    >
      <Triggers />
      <CelebrationDecor />
    </CelebrationProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId('enabled').textContent).toBe('true'),
  );
};

const playedScenes = () =>
  onNotify.mock.calls.map(([{ message }]) => message as string);

describe('Celebration scene selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumed = null;
  });

  afterEach(() => vi.restoreAllMocks());

  it('plays every scene and behavior when the host selects nothing', async () => {
    await renderWith();
    for (let click = 0; click < 12; click++) {
      fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    }
    expect(new Set(playedScenes())).toEqual(new Set(['g', 'b', 'c']));
    expect(screen.getByTestId('behavior-sparkle').textContent).toBe('true');
    expect(screen.getByTestId('behavior-dance').textContent).toBe('true');
  });

  it('never plays a disabled scene, from a click or a direct call', async () => {
    await renderWith({ disabledScenes: ['cat'] });
    for (let click = 0; click < 12; click++) {
      fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'cat' }));

    expect(playedScenes()).not.toContain('c');
    expect(screen.queryByTestId('scene-cat')).toBeNull();
  });

  it('keeps only the allow-listed scenes and sends the phrase when none of its scenes is left', async () => {
    await renderWith({ enabledScenes: ['ghosts'] });
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));

    expect(playedScenes()).toEqual(['g', 'g']);
    expect(consumed).toBe(false);
  });

  it('keeps the trigger inert when every click scene is disabled', async () => {
    await renderWith({ disabledScenes: ['ghosts', 'bats', 'cat'] });
    fireEvent.click(screen.getByRole('button', { name: 'activate' }));

    expect(onNotify).not.toHaveBeenCalled();
  });

  it('consumes the phrase only for its enabled scenes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await renderWith({ disabledScenes: ['spiders'] });
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));

    expect(consumed).toBe(true);
    expect(playedScenes()).toEqual(['c']);
  });

  it('sends the phrase normally when the host disables the secret', async () => {
    await renderWith({ isSecretEnabled: false });
    fireEvent.click(screen.getByRole('button', { name: 'secret' }));

    expect(consumed).toBe(false);
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('switches off only the disabled decoration behaviors', async () => {
    await renderWith({ disabledDecorBehaviors: ['dance'] });

    expect(screen.getByTestId('behavior-sparkle').textContent).toBe('true');
    expect(screen.getByTestId('behavior-dance').textContent).toBe('false');
  });

  it('ignores unknown scene and behavior ids', async () => {
    await renderWith({
      disabledScenes: ['werewolf'],
      disabledDecorBehaviors: ['howl'],
    });
    for (let click = 0; click < 12; click++) {
      fireEvent.click(screen.getByRole('button', { name: 'activate' }));
    }

    expect(new Set(playedScenes())).toEqual(new Set(['g', 'b', 'c']));
    expect(screen.getByTestId('behavior-dance').textContent).toBe('true');
  });
});
