import { ErrorMessageDiv } from '@/src/components/Chat/ErrorMessageDiv';
import { cleanup, findByText, render } from '@testing-library/react';
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
        // Act
        const errorTitle = getByText(error.title);
        // Assert
        expect(errorTitle).toBeInTheDocument();

        error.messageLines.forEach((line) => {
            expect(getByText(line)).toBeInTheDocument();
        });

        expect(getByText(`Code: ${error.code}`)).toBeInTheDocument();
    });

    it('shouldn\'t render error code if it\'s empty', async () => {
        // Arrange
        const { queryByText } = render(<ErrorMessageDiv error={{ ...error, code: null }} />);
        // Act
        const codeBlock = queryByText(/^Code/ig)
        // Assert
        expect(codeBlock).toBeNull();
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
