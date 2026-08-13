import { extractPromptParams } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PromptParametersPopup } from '../PromptParametersPopup';

const renderPopup = async (
  props?: Partial<ComponentProps<typeof PromptParametersPopup>>,
) => {
  const result = render(
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

  /*
   * The Popup's FloatingFocusManager moves focus to the dialog container in a
   * passive effect that lands shortly after mount. Waiting for it here avoids
   * a race where interacting with a field immediately after render loses that
   * field's focus (and its first keystrokes) once the effect finally fires.
   */
  await waitFor(() => {
    expect(document.activeElement?.getAttribute('role')).toBe('dialog');
  });

  return result;
};

describe('PromptParametersPopup', () => {
  it('renders the title and one field per parameter', async () => {
    await renderPopup();

    expect(screen.getByText('Prompt parameters')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'text' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'tone' })).toBeTruthy();
  });

  it('renders one field for a token repeated in the content, via extractPromptParams', async () => {
    const content = '{{name}}, meet {{name}} again.';
    await renderPopup({ content, parameters: extractPromptParams(content) });

    expect(screen.getAllByRole('textbox', { name: 'name' })).toHaveLength(1);
  });

  it('does not render a back chevron when onBack is omitted', async () => {
    await renderPopup();

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('renders a back chevron when onBack is provided', async () => {
    await renderPopup({ onBack: vi.fn() });

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('calls onBack when the back chevron is clicked', async () => {
    const onBack = vi.fn();
    await renderPopup({ onBack });

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Submit until every parameter field is filled', async () => {
    const user = userEvent.setup();
    await renderPopup();

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
    await renderPopup({ onSubmit });

    await user.click(screen.getByRole('textbox', { name: 'text' }));
    await user.type(screen.getByRole('textbox', { name: 'text' }), 'hello');
    await user.click(screen.getByRole('textbox', { name: 'tone' }));
    await user.type(screen.getByRole('textbox', { name: 'tone' }), 'formal');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onSubmit).toHaveBeenCalledWith({ text: 'hello', tone: 'formal' });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    await renderPopup({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
