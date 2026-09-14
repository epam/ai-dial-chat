import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskConfigurationSection } from '../ScheduledTaskConfigurationSection';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MDMessageViewer: ({ content }: { content: string }) => (
      <div data-markdown>{content}</div>
    ),
  };
});

describe('ScheduledTaskConfigurationSection', () => {
  it('renders the instructions label and markdown through the shared viewer by default', () => {
    render(
      <ScheduledTaskConfigurationSection
        instructionsLabel="Instructions"
        instructionsMarkdown="# Plan"
      />,
    );

    expect(screen.getByRole('group', { name: 'Instructions' })).toBeTruthy();
    expect(screen.getByText('Instructions')).toBeTruthy();
    expect(screen.getByText('# Plan')).toBeTruthy();
  });

  it('delegates rendering to renderInstructions when supplied', () => {
    render(
      <ScheduledTaskConfigurationSection
        instructionsLabel="Instructions"
        instructionsMarkdown="# Plan"
        renderInstructions={(markdown) => <em>{markdown}</em>}
      />,
    );

    expect(screen.getByText('# Plan')).toBeTruthy();
  });

  it('renders the label but no content when no markdown is supplied', () => {
    render(
      <ScheduledTaskConfigurationSection instructionsLabel="Instructions" />,
    );

    expect(screen.getByText('Instructions')).toBeTruthy();
    expect(screen.queryByText('# Plan')).toBeNull();
  });
});
