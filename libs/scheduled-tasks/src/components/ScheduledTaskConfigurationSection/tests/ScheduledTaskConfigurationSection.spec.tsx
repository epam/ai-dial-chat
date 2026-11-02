import { MDMessageViewer } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskConfigurationSection } from '../ScheduledTaskConfigurationSection';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MDMessageViewer: vi.fn(({ content }: { content: string }) => (
      <div data-markdown>{content}</div>
    )),
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

  it('renders the built-in instructions at the compact prose step, not the viewer default', () => {
    render(
      <ScheduledTaskConfigurationSection
        instructionsLabel="Instructions"
        instructionsMarkdown="# Plan"
      />,
    );

    /* The viewer is called with the section's scoped classNames record:
     * paragraphs (from the COMPACT spread) and list items (the ul/ol
     * override) both render at `dial-small-paragraph-text` (14px/24px) —
     * the same prose step as the card description — instead of the
     * viewer's `dial-body-paragraph-text` default or the ambient list
     * font. Asserting the record's fields (not object identity) — the
     * mocked module and the component can resolve different module
     * instances of the shared constants. */
    const calls = vi.mocked(MDMessageViewer).mock.calls;
    const classNames = calls[calls.length - 1]?.[0]?.classNames as
      { p?: string; ul?: string } | undefined;
    expect(classNames?.p).toContain('dial-small-paragraph-text');
    expect(classNames?.ul).toContain('dial-small-paragraph-text');
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
        skillDisplayNames={['skills/public/deleted']}
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
