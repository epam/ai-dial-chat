import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemHeader } from '../ItemHeader';

const WIDTH_CAP_CLASS = 'max-w-[30%]';

describe('ItemHeader', () => {
  it('renders a numeric postfix in full without the width cap', () => {
    render(<ItemHeader title="Browse" postfix={1290} />);

    const count = screen.getByText('1290');
    expect(count.classList.contains(WIDTH_CAP_CLASS)).toBe(false);
    expect(count.classList.contains('whitespace-nowrap')).toBe(true);
  });

  it('caps a string postfix at 30% of the row', () => {
    render(<ItemHeader title="Assistant" postfix="1.0.0-beta.42" />);

    expect(
      screen.getByText('1.0.0-beta.42').classList.contains(WIDTH_CAP_CLASS),
    ).toBe(true);
  });

  it('renders a zero count', () => {
    render(<ItemHeader title="Browse" postfix={0} />);

    expect(screen.getByText('0')).toBeTruthy();
  });
});
