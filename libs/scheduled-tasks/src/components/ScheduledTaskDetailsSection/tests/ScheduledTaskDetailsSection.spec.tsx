import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ScheduledTaskDetailsSectionProps } from '../../../models/scheduled-task-details-section-props';
import { ScheduledTaskDetailsSection } from '../ScheduledTaskDetailsSection';

const labels: ScheduledTaskDetailsSectionProps['labels'] = {
  descriptionLabel: 'Description',
  modelLabel: 'Model or Agent',
  repeatsLabel: 'Repeats',
  activeWindowLabel: 'Active',
  completedFieldLabel: 'Status',
};

const renderSection = (props?: Partial<ScheduledTaskDetailsSectionProps>) =>
  render(<ScheduledTaskDetailsSection labels={labels} {...props} />);

describe('ScheduledTaskDetailsSection', () => {
  it('renders every provided field with its label and value', () => {
    renderSection({
      description: 'Summarize the news',
      modelLabel: 'GPT-4o',
      repeatsLabel: 'Every Monday 12:00',
      activeWindowLabel: 'Aug 1, 2026 – Dec 31, 2026',
    });

    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Summarize the news')).toBeTruthy();
    expect(screen.getByText('Model or Agent')).toBeTruthy();
    expect(screen.getByText('GPT-4o')).toBeTruthy();
    expect(screen.getByText('Repeats')).toBeTruthy();
    expect(screen.getByText('Every Monday 12:00')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Aug 1, 2026 – Dec 31, 2026')).toBeTruthy();
  });

  it('omits fields whose value is not supplied', () => {
    renderSection({ description: 'Summarize the news' });

    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.queryByText('Model or Agent')).toBeNull();
    expect(screen.queryByText('Repeats')).toBeNull();
    expect(screen.queryByText('Active')).toBeNull();
  });

  it('preserves the description line breaks and wraps long unbroken values', () => {
    renderSection({ description: 'a'.repeat(600) });

    const value = screen.getByText('a'.repeat(600));
    expect(value.className).toContain('whitespace-pre-wrap');
    expect(value.className).toContain('[overflow-wrap:anywhere]');
    expect(value.className).not.toContain('break-all');
  });

  it('renders the description at the same field step as the other values', () => {
    renderSection({
      description: 'Summarize the news',
      modelLabel: 'GPT-4o',
      fieldValueClassName: 'dial-body-text',
    });

    expect(screen.getByText('Summarize the news').className).toContain(
      'dial-body-text',
    );
    expect(screen.getByText('GPT-4o').className).toContain('dial-body-text');
  });

  it('lets every field group shrink below its content width', () => {
    renderSection({
      description: 'Summarize the news',
      modelLabel: 'GPT-4o',
      repeatsLabel: 'Every Monday 12:00',
      activeWindowLabel: 'Aug 1, 2026 – Dec 31, 2026',
      completedLabel: 'Completed',
    });

    const groups = screen
      .getAllByText(/Description|Model or Agent|Repeats|Active|Status/)
      // eslint-disable-next-line testing-library/no-node-access -- verifying the group's CSS classes (flex shrink), which carry no accessible role of their own
      .map((label) => label.parentElement);
    for (const group of groups) {
      expect(group?.className).toContain('min-w-0');
    }
  });
});
