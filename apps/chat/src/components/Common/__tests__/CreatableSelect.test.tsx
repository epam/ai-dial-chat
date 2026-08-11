import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatableSelect } from '@/src/components/Common/CreatableSelect';

const options = [
  { label: 'Tool 1', value: 'tool-1' },
  { label: 'Tool 2', value: 'tool-2' },
];

describe('CreatableSelect', () => {
  it('renders the selected values as removable pills', () => {
    render(<CreatableSelect options={options} value={[options[0]]} />);

    const removeButton = screen.getByTestId(
      `unselect-item-${options[0].value}`,
    );

    expect(screen.getByText(options[0].label)).toBeInTheDocument();
    expect(removeButton.tagName).toBe('BUTTON');
    // The ui-kit icon button is what gives the pill its square hover state.
    expect(removeButton).toHaveClass('dial-icon-button');
  });

  it('removes a value when its pill button is clicked', async () => {
    const onChange = vi.fn();
    render(
      <CreatableSelect
        options={options}
        value={[options[0], options[1]]}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByTestId(`unselect-item-${options[0].value}`),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([options[1]]);
  });

  it('sizes the remove and dropdown icons consistently at 16px', () => {
    const { container } = render(
      <CreatableSelect options={options} value={[options[0]]} />,
    );

    // Icon dimensions live on the SVG itself, which no Testing Library query reaches.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icons = container.querySelectorAll('svg');

    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect(icon.getAttribute('width')).toBe('16');
      expect(icon.getAttribute('height')).toBe('16');
    });
  });

  it('keeps react-select styling props out of the DOM', () => {
    render(<CreatableSelect options={options} value={[options[0]]} />);

    const removeButton = screen.getByTestId(
      `unselect-item-${options[0].value}`,
    );

    expect(removeButton.hasAttribute('css')).toBe(false);
  });
});
