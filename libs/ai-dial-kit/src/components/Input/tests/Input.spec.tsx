import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialInput: ({
    value,
    onChange,
    className,
    labelProps,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    className?: string;
    labelProps?: { label?: string };
  }) => (
    <label>
      {labelProps?.label}
      <input
        className={className}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  ),
}));

describe('Input', () => {
  it('forwards a caller className to the underlying DialInput unchanged', () => {
    render(
      <Input value="" className="custom" labelProps={{ label: 'Name' }} />,
    );
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.className).toBe('custom');
  });

  it('forwards value and onChange to the underlying DialInput', () => {
    const onChange = vi.fn();
    render(
      <Input value="a" onChange={onChange} labelProps={{ label: 'Name' }} />,
    );
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'b' },
    });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
