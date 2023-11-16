import { ScrollDownButton } from '@/src/components/Chat/ScrollDownButton';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';

describe('ScrollDownButton', () => {
    // preparation
    const props = {
        onScrollDownClick: vi.fn(),
        className: 'test class'
    }

    it('should render the component', () => {
        // Arrange
        const { container } = render(<ScrollDownButton {...props} />);
        // Act
        const button = container.querySelector('button') as HTMLButtonElement;
        const icon = button.querySelector('svg') as SVGSVGElement;
        // Assert
        expect(button).toBeInTheDocument();
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('tabler-icon-arrow-down');
        expect(icon.getAttribute('width')).toBe('24');
        expect(icon.getAttribute('height')).toBe('24');
    });

    it('should call the onScrollDownClick function when the button is clicked', async () => {
        // Arrange
        const { getByRole } = render(<ScrollDownButton {...props} />);
        // Act
        const button = getByRole('button');
        await userEvent.click(button);
        // Assert
        expect(props.onScrollDownClick).toHaveBeenCalledTimes(1)
    });

    it('should accept a custom className prop', () => {
        // Arrange
        const className = 'custom-class-name';
        const { container } = render(<ScrollDownButton {...props} className={className} />);
        // Act
        const buttonContainer = container.querySelector('div') as HTMLDivElement;
        // Assert
        expect(buttonContainer).toHaveClass(className);
    });
});
