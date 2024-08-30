import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';

import { ErrorMessageDiv } from '@/src/components/Chat/ErrorMessageDiv';

describe('ErrorMessageDiv', () => {
  // preparation
  const error = {
    title: 'Error title',
    messageLines: ['Error message line 1', 'Error message line 2'],
    code: '123',
  };

  it('should render the correct error message', () => {
    // Arrange
    render(<ErrorMessageDiv error={error} />);
    // Act
    const errorTitle = screen.getByText(error.title);
    // Assert
    expect(errorTitle).toBeInTheDocument();

    error.messageLines.forEach((line) => {
      expect(screen.getByText(line)).toBeInTheDocument();
    });

    expect(
      screen.getByText(`common.label.code ${error.code}`),
    ).toBeInTheDocument();
  });

  it("shouldn't render error code if it's empty", async () => {
    // Arrange
    render(<ErrorMessageDiv error={{ ...error, code: null }} />);
    // Act
    const codeBlock = screen.queryByText(/^Code/i);
    // Assert
    expect(codeBlock).toBeNull();
  });

  it('should render the IconCircleX component', () => {
    // Arrange
    const { container } = render(<ErrorMessageDiv error={error} />);
    // Act
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector('svg') as SVGSVGElement;
    // Assert
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('tabler-icon-circle-x');
    expect(icon.getAttribute('width')).toBe('36');
  });
});
