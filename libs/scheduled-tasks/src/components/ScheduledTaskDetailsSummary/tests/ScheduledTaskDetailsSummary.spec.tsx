import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskDetailsSummary } from '../ScheduledTaskDetailsSummary';

/* Captures every mock-rendered MDMessageViewer's props so label forwarding is assertable. */
const viewerCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MDMessageViewer: (props: Record<string, unknown>) => {
      viewerCalls.push(props);
      return <div>{props.content as string}</div>;
    },
  };
});

beforeEach(() => {
  viewerCalls.length = 0;
});

describe('ScheduledTaskDetailsSummary', () => {
  it('shows all skill names and URL fallbacks in order, hiding an empty selection', () => {
    const { container, rerender } = render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        skillLabel="Skills"
        instructionsLabel="Instructions"
        skillDisplayNames={['Report', 'skills/public/deleted']}
      />,
    );
    expect(container.textContent).toBe('SkillsReportskills/public/deleted');
    rerender(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        skillLabel="Skills"
        instructionsLabel="Instructions"
        skillDisplayNames={[]}
      />,
    );
    expect(screen.queryByText('Skills')).toBeNull();
  });

  it.each(['Resolved skill', 'skills/public/deleted'])(
    'renders Skill between Model and Instructions: %s',
    (skillDisplayNames) => {
      const { container, rerender } = render(
        <ScheduledTaskDetailsSummary
          modelLabel="Model"
          modelDisplayName="Model A"
          skillLabel="Skill"
          skillDisplayNames={[skillDisplayNames]}
          instructionsLabel="Instructions"
          instructionsMarkdown="Do work"
        />,
      );
      expect(container.textContent).toBe(
        `ModelModel ASkill${skillDisplayNames}InstructionsDo work`,
      );
      rerender(
        <ScheduledTaskDetailsSummary
          modelLabel="Model"
          instructionsLabel="Instructions"
        />,
      );
      expect(screen.queryByText('Skill')).toBeNull();
    },
  );
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

  it('renders field labels tiny and secondary, values small by default', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        modelDisplayName="GPT-5.1"
        skillLabel="Skill"
        skillDisplayNames={['Translate Text']}
        instructionsLabel="Instructions"
        instructionsMarkdown="Do work"
      />,
    );

    expect(screen.getByText('Model').className).toContain('dial-tiny-text');
    expect(screen.getByText('Model').className).toContain('text-secondary');
    expect(screen.getByText('GPT-5.1').className).toContain('dial-small-text');
    expect(screen.getByText('Skill').className).toContain('dial-tiny-text');
    expect(screen.getByText('Skill').className).toContain('text-secondary');
  });

  it('forwards the supplied markdown labels to the default renderer, omitting them otherwise', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown="plain instructions"
      />,
    );
    expect(viewerCalls.at(-1)).toMatchObject({ content: 'plain instructions' });
    expect(viewerCalls.at(-1)?.codeBlockCopyLabel).toBeUndefined();

    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        instructionsMarkdown="plain instructions"
        markdownLabels={{
          codeBlockCopyLabel: 'Kopiuj',
          codeBlockCopiedLabel: 'Skopiowano',
          codeBlockDownloadLabel: 'Pobierz',
          tableScrollRegionAriaLabel: 'Przewijalna tabela',
          mathScrollRegionAriaLabel: 'Przewijalny wzór',
        }}
      />,
    );
    expect(viewerCalls.at(-1)).toMatchObject({
      codeBlockCopyLabel: 'Kopiuj',
      codeBlockCopiedLabel: 'Skopiowano',
      codeBlockDownloadLabel: 'Pobierz',
      tableScrollRegionAriaLabel: 'Przewijalna tabela',
      mathScrollRegionAriaLabel: 'Przewijalny wzór',
    });
  });

  it('lets a host override the field label and value classes', () => {
    render(
      <ScheduledTaskDetailsSummary
        modelLabel="Model"
        instructionsLabel="Instructions"
        modelDisplayName="GPT-5.1"
        instructionsMarkdown="Do work"
        styles={{
          typography: {
            fieldLabelClassName: 'custom-label',
            fieldValueClassName: 'custom-value',
          },
        }}
      />,
    );

    expect(screen.getByText('Model').className).toContain('custom-label');
    expect(screen.getByText('GPT-5.1').className).toContain('custom-value');
  });
});
