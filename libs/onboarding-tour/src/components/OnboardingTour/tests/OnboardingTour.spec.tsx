import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OnboardingTourProps,
  OnboardingTourStep,
} from '../../../models/onboarding-tour';
import { OnboardingTour } from '../OnboardingTour';

const byLabel = (label: string) => () => screen.queryByLabelText(label);

const stepsFixture = (): OnboardingTourStep[] => [
  {
    id: 'new-chat',
    title: 'Start a chat',
    description: 'Start a chat body',
    getTarget: byLabel('New chat'),
  },
  { id: 'composer', title: 'Ask here', getTarget: byLabel('Message') },
];

/* A host that clears the steps once the tour reports them finished. */
const Host = ({
  initialSteps,
  onFinish,
  ...tourProps
}: Partial<OnboardingTourProps> & {
  initialSteps: OnboardingTourStep[];
  onFinish: (ids: string[]) => void;
}) => {
  const [steps, setSteps] = useState(initialSteps);
  return (
    <>
      <button type="button" aria-label="New chat">
        +
      </button>
      <textarea aria-label="Message" />
      <OnboardingTour
        {...tourProps}
        steps={steps}
        onFinish={(ids) => {
          onFinish(ids);
          setSteps([]);
        }}
      />
    </>
  );
};

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 10,
      width: 40,
      height: 20,
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing without steps', () => {
    render(<OnboardingTour steps={[]} onFinish={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('walks through the steps and reports them once done', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Host initialSteps={stepsFixture()} onFinish={onFinish} />);

    const dialog = screen.getByRole('dialog', { name: 'Start a chat' });
    expect(dialog.textContent).toContain('Step 1 of 2');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no query; the focused element is the assertion
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Ask here' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Start a chat' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onFinish).toHaveBeenCalledWith(['new-chat', 'composer']);
  });

  it('reports every step when skipped with Escape', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Host initialSteps={stepsFixture()} onFinish={onFinish} />);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onFinish).toHaveBeenCalledWith(['new-chat', 'composer']);
  });

  it('skips a step whose target is gone', () => {
    const [, composer] = stepsFixture();
    render(
      <Host
        initialSteps={[
          { id: 'missing', title: 'Gone', getTarget: () => null },
          composer,
        ]}
        onFinish={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Ask here' })).toBeTruthy();
  });

  it('finishes when no step has a target', () => {
    const onFinish = vi.fn();
    render(
      <Host
        initialSteps={[{ id: 'missing', title: 'Gone', getTarget: () => null }]}
        onFinish={onFinish}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onFinish).toHaveBeenCalledWith(['missing']);
  });

  it('renders host labels', async () => {
    const user = userEvent.setup();
    render(
      <Host
        initialSteps={stepsFixture()}
        onFinish={vi.fn()}
        labels={{
          stepCounter: (current, total) => `${current}/${total}`,
          next: 'Weiter',
          skip: 'Überspringen',
          close: 'Schließen',
        }}
      />,
    );
    expect(screen.getByRole('dialog').textContent).toContain('1/2');
    expect(screen.getByRole('button', { name: 'Überspringen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('dialog').textContent).toContain('2/2');
  });

  it('applies color overrides as custom properties', () => {
    render(
      <Host
        initialSteps={stepsFixture()}
        onFinish={vi.fn()}
        colors={{ cardBackground: 'red' }}
      />,
    );
    // eslint-disable-next-line testing-library/no-node-access -- the overlay root has no role; the custom property on it is the assertion
    const root = screen.getByRole('dialog').parentElement;
    expect(root?.style.getPropertyValue('--ot-card-bg')).toBe('red');
  });
});
