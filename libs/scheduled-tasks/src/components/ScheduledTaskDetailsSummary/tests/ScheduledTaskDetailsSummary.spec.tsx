import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskDetailsSummary } from '../ScheduledTaskDetailsSummary';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MDMessageViewer: ({ content }: { content: string }) => <div>{content}</div>,
  };
});

describe('ScheduledTaskDetailsSummary', () => {
  it('renders the resolved model display name', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        modelDisplayName="GPT-5.1"
      />,
    );

    expect(screen.getByText('Model')).toBeTruthy();
    expect(screen.getByText('GPT-5.1')).toBeTruthy();
  });

  it('renders the raw model id when no display name is resolved but one is supplied as the value', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        modelDisplayName="gpt-5.1-raw-id"
      />,
    );

    expect(screen.getByText('gpt-5.1-raw-id')).toBeTruthy();
  });

  it('hides the model field entirely when modelDisplayName is omitted', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
      />,
    );

    expect(screen.queryByText('Model')).toBeNull();
  });

  it('renders instructions markdown via the injected renderInstructions callback', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown="**bold** text"
        renderInstructions={(markdown) => <div>rendered:{markdown}</div>}
      />,
    );

    expect(screen.getByText('rendered:**bold** text')).toBeTruthy();
  });

  it('falls back to MDMessageViewer when renderInstructions is not supplied', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown="plain instructions"
      />,
    );

    expect(screen.getByText('plain instructions')).toBeTruthy();
  });

  it('renders no edit affordance', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        modelDisplayName="GPT-5.1"
        instructionsMarkdown="Do the thing"
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
