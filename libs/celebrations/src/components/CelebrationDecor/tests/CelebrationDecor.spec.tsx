import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CELEBRATIONS_CLASS } from '../../../constants/public-class-names';
import { CelebrationProvider } from '../../../context/CelebrationContext';
import { HALLOWEEN_LABELS } from '../../../halloween/constants/labels';
import { halloweenEvent } from '../../../halloween/event';
import { NEW_YEAR_LABELS } from '../../../new-year/constants/labels';
import { newYearEvent } from '../../../new-year/event';
import { CelebrationDecor } from '../CelebrationDecor';

const renderDecor = (activeEventId: string, onNotify = vi.fn()) =>
  render(
    <CelebrationProvider
      events={{
        halloween: async () => halloweenEvent,
        'new-year': async () => newYearEvent,
      }}
      activeEventId={activeEventId}
      onNotify={onNotify}
    >
      <CelebrationDecor />
    </CelebrationProvider>,
  );

describe('CelebrationDecor', () => {
  it.each([
    ['halloween', HALLOWEEN_LABELS.pumpkinLabel],
    ['new-year', NEW_YEAR_LABELS.giftLabel],
  ])('emits the public decor and trigger classes for %s', async (id, name) => {
    renderDecor(id);

    const trigger = await screen.findByRole('button', { name });
    expect(trigger.className).toContain(CELEBRATIONS_CLASS.trigger);
    // eslint-disable-next-line testing-library/no-node-access
    expect(trigger.closest(`.${CELEBRATIONS_CLASS.decor}`)).not.toBeNull();
  });

  it('plays a scene in the public scene layer when the trigger is pressed', async () => {
    const onNotify = vi.fn();
    renderDecor('new-year', onNotify);

    await userEvent.click(
      await screen.findByRole('button', { name: NEW_YEAR_LABELS.giftLabel }),
    );

    expect(onNotify).toHaveBeenCalledOnce();
    expect(
      // eslint-disable-next-line testing-library/no-node-access
      document.body.querySelector(`.${CELEBRATIONS_CLASS.sceneLayer}`),
    ).not.toBeNull();
  });

  it('renders nothing without an active event', () => {
    const { container } = render(<CelebrationDecor />);

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.childElementCount).toBe(0);
  });
});
