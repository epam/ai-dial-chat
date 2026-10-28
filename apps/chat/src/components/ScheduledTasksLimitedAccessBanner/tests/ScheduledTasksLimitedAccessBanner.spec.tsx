import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScheduledTasksLimitedAccessBanner from '../ScheduledTasksLimitedAccessBanner';

const PROPS = {
  title: 'Limited access.',
  body: "You can't create or edit tasks. Contact your administrator for more details.",
};

describe('ScheduledTasksLimitedAccessBanner', () => {
  it('renders the title and description inside the alert, with no stacked heading', () => {
    render(<ScheduledTasksLimitedAccessBanner {...PROPS} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(PROPS.title);
    expect(alert.textContent).toContain(PROPS.body);
    /* The kit stacks its `title` prop above the message; the composed
     * one-line message carries no heading element of its own. */
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders no action and no close control', () => {
    render(<ScheduledTasksLimitedAccessBanner {...PROPS} />);

    expect(
      screen.queryByRole('button', { name: /log in|retry|close|dismiss/i }),
    ).toBeNull();
  });
});
