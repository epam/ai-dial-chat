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

  it('hides empty instructions and absent skills', () => {
    render(
      <ScheduledTaskConfigurationSection instructionsLabel="Instructions" />,
    );

    expect(screen.queryByText('Instructions')).toBeNull();
    expect(screen.queryByText('# Plan')).toBeNull();
  });

  it('shows the skill alone with a full-reference fallback and no navigation', () => {
    render(
      <ScheduledTaskConfigurationSection
        skillLabel="Skill"
        skillDisplayName="skills/public/deleted"
        instructionsLabel="Instructions"
        instructionsMarkdown=""
      />,
    );
    expect(screen.getByRole('group', { name: 'Skill' })).toBeTruthy();
    expect(screen.getByText('skills/public/deleted')).toBeTruthy();
    expect(screen.queryByText('Instructions')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
