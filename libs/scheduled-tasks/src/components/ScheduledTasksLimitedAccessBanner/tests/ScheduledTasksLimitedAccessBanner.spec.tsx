import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScheduledTasksLimitedAccessBanner } from '../ScheduledTasksLimitedAccessBanner';

describe('ScheduledTasksLimitedAccessBanner', () => {
  it('renders the English defaults with the default typography', () => {
    render(<ScheduledTasksLimitedAccessBanner />);

    expect(screen.getByText('Limited access.').className).toContain(
      'dial-small-paragraph-semi-text',
    );
    expect(
      screen.getByText(
        "You can't create or edit tasks. Contact your administrator for more details.",
      ),
    ).toBeTruthy();
  });

  it('renders host labels and typography', () => {
    render(
      <ScheduledTasksLimitedAccessBanner
        labels={{
          title: 'Доступ ограничен.',
          body: 'Обратитесь к администратору.',
        }}
        bodyClassName="dial-body-text"
      />,
    );

    expect(screen.getByText('Доступ ограничен.')).toBeTruthy();
    expect(
      screen.getByText('Обратитесь к администратору.').className,
    ).toContain('dial-body-text');
  });
});
