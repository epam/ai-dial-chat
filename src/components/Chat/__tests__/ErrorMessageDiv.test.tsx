import { ErrorMessageDiv } from '@/src/components/Chat/ErrorMessageDiv';
import { cleanup, render } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';

describe('ErrorMessageDiv', () => {
    // preparation
    const error = {
        title: 'Error title',
        messageLines: ['Error message line 1', 'Error message line 2'],
        code: '123',
    };

    // cleanup
    afterEach(cleanup);

    it('should render the correct error message', () => {
        // Arrange
        const { getByText } = render(<ErrorMessageDiv error={error} />);
        // Assert
        expect(getByText(error.title)).toBeInTheDocument();

        error.messageLines.forEach((line) => {
            expect(getByText(line)).toBeInTheDocument();
        });

        expect(getByText(`Code: ${error.code}`)).toBeInTheDocument();
    });

    it('should render the IconCircleX component', () => {
        // Arrange
        const { container } = render(<ErrorMessageDiv error={error} />);
        // Act
        const icon = container.querySelector('svg') as SVGSVGElement;
        // Assert
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('tabler-icon-circle-x');
        expect(icon.getAttribute('width')).toBe('36');
    });
});