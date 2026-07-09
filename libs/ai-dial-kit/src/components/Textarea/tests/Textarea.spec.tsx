import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Textarea } from '../Textarea';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialTextarea: ({
    value,
    onChange,
    className,
    labelProps,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    className?: string;
    labelProps?: { label?: string };
  }) => (
    <label>
      {labelProps?.label}
      <textarea
        className={className}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  ),
}));

describe('Textarea', () => {
  it('forwards a caller className to the underlying DialTextarea unchanged', () => {
    render(
      <Textarea
        value=""
        className="custom"
        labelProps={{ label: 'Description' }}
      />,
    );
    const textarea = screen.getByLabelText(
      'Description',
    ) as HTMLTextAreaElement;
    expect(textarea.className).toBe('custom');
  });

  it('forwards value and onChange to the underlying DialTextarea', () => {
    const onChange = vi.fn();
    render(
      <Textarea
        value="a"
        onChange={onChange}
        labelProps={{ label: 'Description' }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'b' },
    });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
