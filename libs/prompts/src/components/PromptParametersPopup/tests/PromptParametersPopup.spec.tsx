import { extractPromptParams } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PromptParametersPopup } from '../PromptParametersPopup';

const renderPopup = (
  props?: Partial<ComponentProps<typeof PromptParametersPopup>>,
) =>
  render(
    <PromptParametersPopup
      open
      promptName="Summarizer"
      content="Summarize {{text}} in {{tone}} tone."
      parameters={['text', 'tone']}
      onClose={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  );

describe('PromptParametersPopup', () => {
  it('renders the title and one field per parameter', () => {
    renderPopup();

    expect(screen.getByText('Prompt parameters')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'text' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'tone' })).toBeTruthy();
  });

  it('renders one field for a token repeated in the content, via extractPromptParams', () => {
    const content = '{{name}}, meet {{name}} again.';
    renderPopup({ content, parameters: extractPromptParams(content) });

    expect(screen.getAllByRole('textbox', { name: 'name' })).toHaveLength(1);
  });

  it('does not render a back chevron when onBack is omitted', () => {
    renderPopup();

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('renders a back chevron when onBack is provided', () => {
    renderPopup({ onBack: vi.fn() });

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('calls onBack when the back chevron is clicked', async () => {
    const onBack = vi.fn();
    renderPopup({ onBack });

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Submit until every parameter field is filled', async () => {
    const user = userEvent.setup();
    renderPopup();

    const submit = screen.getByRole('button', { name: 'Confirm' });
    expect(submit.hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('textbox', { name: 'text' }));
    await user.type(screen.getByRole('textbox', { name: 'text' }), 'a');
    expect(submit.hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('textbox', { name: 'tone' }));
    await user.type(screen.getByRole('textbox', { name: 'tone' }), 'b');
    expect(submit.hasAttribute('disabled')).toBe(false);
  });

  it('calls onSubmit with the entered values when Submit is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderPopup({ onSubmit });

    await user.click(screen.getByRole('textbox', { name: 'text' }));
    await user.type(screen.getByRole('textbox', { name: 'text' }), 'hello');
    await user.click(screen.getByRole('textbox', { name: 'tone' }));
    await user.type(screen.getByRole('textbox', { name: 'tone' }), 'formal');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onSubmit).toHaveBeenCalledWith({ text: 'hello', tone: 'formal' });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    renderPopup({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
