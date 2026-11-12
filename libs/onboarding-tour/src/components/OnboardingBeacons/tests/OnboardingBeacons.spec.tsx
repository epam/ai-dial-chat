import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OnboardingBeaconsProps,
  OnboardingTourStep,
} from '../../../models/onboarding-tour';
import { OnboardingBeacons } from '../OnboardingBeacons';

const byLabel = (label: string) => () => screen.queryByLabelText(label);

const hintsFixture = (): OnboardingTourStep[] => [
  {
    id: 'new-chat',
    title: 'Start a chat',
    description: 'Start a chat body',
    getTarget: byLabel('New chat'),
  },
  { id: 'composer', title: 'Ask here', getTarget: byLabel('Message') },
];

/* A host that drops a hint once it is dismissed. */
const Host = ({
  initialHints,
  onDismiss,
  isComposerShown = true,
  ...props
}: Partial<OnboardingBeaconsProps> & {
  initialHints: OnboardingTourStep[];
  onDismiss: (id: string) => void;
  isComposerShown?: boolean;
}) => {
  const [hints, setHints] = useState(initialHints);
  return (
    <>
      <button type="button" aria-label="New chat">
        +
      </button>
      {isComposerShown && <textarea aria-label="Message" />}
      <OnboardingBeacons
        {...props}
        hints={hints}
        onDismiss={(id) => {
          onDismiss(id);
          setHints((current) => current.filter((hint) => hint.id !== id));
        }}
      />
    </>
  );
};

describe('OnboardingBeacons', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 10,
      top: 10,
      left: 10,
      right: 50,
      bottom: 30,
      width: 40,
      height: 20,
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a beacon for each hint whose target is on screen', () => {
    render(<Host initialHints={hintsFixture()} onDismiss={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Show hint: Start a chat' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show hint: Ask here' }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens and closes the hint card from its beacon', async () => {
    const user = userEvent.setup();
    render(<Host initialHints={hintsFixture()} onDismiss={vi.fn()} />);
    const beacon = screen.getByRole('button', {
      name: 'Show hint: Start a chat',
    });

    await user.click(beacon);
    const dialog = screen.getByRole('dialog', { name: 'Start a chat' });
    expect(beacon.getAttribute('aria-expanded')).toBe('true');
    expect(beacon.getAttribute('aria-controls')).toBe(dialog.id);

    await user.click(beacon);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(beacon.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the card on Escape and keeps the beacon', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Host initialHints={hintsFixture()} onDismiss={onDismiss} />);

    await user.click(
      screen.getByRole('button', { name: 'Show hint: Start a chat' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Show hint: Start a chat' }),
    ).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses a hint with Got it', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Host initialHints={hintsFixture()} onDismiss={onDismiss} />);

    await user.click(
      screen.getByRole('button', { name: 'Show hint: Ask here' }),
    );
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledWith('composer');
    expect(
      screen.queryByRole('button', { name: 'Show hint: Ask here' }),
    ).toBeNull();
  });

  it('shows a beacon once its target appears', async () => {
    const { rerender } = render(
      <Host
        initialHints={hintsFixture()}
        onDismiss={vi.fn()}
        isComposerShown={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Show hint: Ask here' }),
    ).toBeNull();

    rerender(<Host initialHints={hintsFixture()} onDismiss={vi.fn()} />);
    expect(
      await screen.findByRole('button', { name: 'Show hint: Ask here' }),
    ).toBeTruthy();
  });

  it('renders host labels', async () => {
    const user = userEvent.setup();
    render(
      <Host
        initialHints={hintsFixture()}
        onDismiss={vi.fn()}
        labels={{ beacon: (title) => `Tipp: ${title}`, gotIt: 'Verstanden' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Tipp: Ask here' }));
    expect(screen.getByRole('button', { name: 'Verstanden' })).toBeTruthy();
  });
});
