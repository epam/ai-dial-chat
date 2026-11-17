import { extractPromptParams } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptParametersPopup } from '../PromptParametersPopup';

const popup = (
  props?: Partial<ComponentProps<typeof PromptParametersPopup>>,
) => (
  <PromptParametersPopup
    open
    promptName="Summarizer"
    content="Summarize {{text}} in {{tone}} tone."
    parameters={[{ name: 'text' }, { name: 'tone' }]}
    onClose={vi.fn()}
    onCancel={vi.fn()}
    onSubmit={vi.fn()}
    {...props}
  />
);

/** The popup as it is rendered for `content`, with parameters read out of it. */
const popupFor = (content: string) =>
  popup({ content, parameters: extractPromptParams(content) });

const fieldValue = (name: string) =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name }).value;

const renderPopup = async (
  props?: Partial<ComponentProps<typeof PromptParametersPopup>>,
) => {
  const view = render(popup(props));

  /*
   * The Popup's FloatingFocusManager moves focus to the dialog container in a
   * passive effect that lands shortly after mount. Waiting for it here avoids
   * a race where interacting with a field immediately after render loses that
   * field's focus (and its first keystrokes) once the effect finally fires.
   */
  await waitFor(() => {
    expect(document.activeElement?.getAttribute('role')).toBe('dialog');
  });

  return view;
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

  it('opens a defaulted field holding its default value', async () => {
    const content = 'Translate into {{language|Spanish}} for {{audience}}.';
    await renderPopup({ content, parameters: extractPromptParams(content) });

    expect(fieldValue('language')).toBe('Spanish');
    expect(fieldValue('audience')).toBe('');
  });

  it('labels a defaulted field with the name alone, without the separator', async () => {
    const content = 'Translate into {{language|Spanish}}.';
    await renderPopup({ content, parameters: extractPromptParams(content) });

    expect(
      screen.queryByRole('textbox', { name: 'language|Spanish' }),
    ).toBeNull();
    expect(screen.getByRole('textbox', { name: 'language' })).toBeTruthy();
  });

  it('enables Submit with no typing when every parameter carries a default', async () => {
    const content = 'Reply in {{language|Spanish}} in a {{tone|formal}} tone.';
    await renderPopup({ content, parameters: extractPromptParams(content) });

    expect(
      screen.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('submits the default when a defaulted field is left untouched', async () => {
    const content = 'Translate into {{language|Spanish}}.';
    const onSubmit = vi.fn();
    await renderPopup({
      content,
      parameters: extractPromptParams(content),
      onSubmit,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onSubmit).toHaveBeenCalledWith({ language: 'Spanish' });
  });

  it('submits the edited value rather than the default when the field is changed', async () => {
    const user = userEvent.setup();
    const content = 'Translate into {{language|Spanish}}.';
    const onSubmit = vi.fn();
    await renderPopup({
      content,
      parameters: extractPromptParams(content),
      onSubmit,
    });

    await user.clear(screen.getByRole('textbox', { name: 'language' }));
    await user.type(
      screen.getByRole('textbox', { name: 'language' }),
      'German',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onSubmit).toHaveBeenCalledWith({ language: 'German' });
  });

  it('offers the default again when the same prompt comes back after another', async () => {
    const user = userEvent.setup();
    const translate = 'Translate into {{language|Spanish}}.';
    const summarize = 'Summarize {{text}}.';
    const { rerender } = await renderPopup({
      content: translate,
      parameters: extractPromptParams(translate),
    });

    await user.clear(screen.getByRole('textbox', { name: 'language' }));
    await user.type(
      screen.getByRole('textbox', { name: 'language' }),
      'German',
    );

    rerender(popupFor(summarize));
    rerender(popupFor(translate));

    expect(fieldValue('language')).toBe('Spanish');
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    await renderPopup({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('PromptParametersPopup on mobile', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only the Parameters tab content first', async () => {
    await renderPopup();

    expect(
      screen
        .getByRole('tab', { name: 'Parameters' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('textbox', { name: 'text' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Details' })).toBeNull();
  });

  it('switches to Details and keeps the entered values', async () => {
    const user = userEvent.setup();
    await renderPopup();

    await user.type(screen.getByRole('textbox', { name: 'text' }), 'hello');
    await user.click(screen.getByRole('tab', { name: /Details/ }));

    expect(screen.queryByRole('textbox', { name: 'text' })).toBeNull();
    expect(screen.getByRole('tabpanel', { name: 'Details' })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /Parameters/ }));

    expect(fieldValue('text')).toBe('hello');
  });

  it('makes the Details panel keyboard focusable', async () => {
    const user = userEvent.setup();
    await renderPopup();

    await user.click(screen.getByRole('tab', { name: /Details/ }));

    expect(
      screen
        .getByRole('tabpanel', { name: 'Details' })
        .getAttribute('tabindex'),
    ).toBe('0');
  });

  it('names the tab list with the tabs label', async () => {
    await renderPopup({ labels: { tabsAriaLabel: 'Sections' } });

    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();
  });

  it('returns to the Parameters tab when the parameters change', async () => {
    const user = userEvent.setup();
    const { rerender } = await renderPopup();

    await user.click(screen.getByRole('tab', { name: /Details/ }));
    expect(
      screen
        .getByRole('tab', { name: /Details/ })
        .getAttribute('aria-selected'),
    ).toBe('true');

    rerender(popupFor('Translate {{language}}.'));

    expect(
      screen
        .getByRole('tab', { name: /Parameters/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });
});
