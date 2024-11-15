import ComponentBuilder from './ComponentBuilder';

import '@testing-library/jest-dom/vitest';
import { fireEvent, render } from '@testing-library/react';
import React, { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

const MockComponent: React.FC<PropsWithChildren<{ text: string }>> = ({
  text,
  children,
}) => (
  <div>
    {text}
    {children}
  </div>
);

describe('ComponentBuilder', () => {
  it('should render the base component', () => {
    const Component = ComponentBuilder.use(MockComponent).build();
    const { getByText } = render(<Component text="Hello" />);
    expect(getByText('Hello')).toBeInTheDocument();
  });

  it('should apply custom class names', () => {
    const Component = ComponentBuilder.use(MockComponent)
      .updateClassNames((classNames) => ({
        ...classNames,
        component: 'custom-class',
      }))
      .build();
    const { container } = render(<Component text="Hello" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply custom styles', () => {
    const Component = ComponentBuilder.use(MockComponent)
      .updateStyles((styles) => ({
        ...styles,
        component: { color: 'red' },
      }))
      .build();
    const { container } = render(<Component text="Hello" />);
    expect(container.firstChild).toHaveStyle('color: red');
  });

  it('should update state using state function', () => {
    const stateFn = vi.fn((state, setState) => {
      setState({ updated: true });
    });

    const Component = ComponentBuilder.use(MockComponent)
      .addState(stateFn)
      .build();

    render(<Component text="Hello" />);
    expect(stateFn).toHaveBeenCalled();
  });

  it('should run effects using effects function', () => {
    const effectFn = vi.fn();
    const Component = ComponentBuilder.use(MockComponent)
      .addEffects(() => [{ effect: effectFn, dependencies: [] }])
      .build();

    render(<Component text="Hello" />);
    expect(effectFn).toHaveBeenCalled();
  });

  it('should update HTML content', () => {
    const Component = ComponentBuilder.use<typeof MockComponent, 'block1'>(
      MockComponent,
    )
      .updateHTML({
        block1: () => <span>Replaced Content</span>,
      })
      .build();

    const { queryByText } = render(
      <Component text="Hello">
        <div data-customize-id="block1">Original Content</div>
      </Component>,
    );

    expect(queryByText('Original Content')).not.toBeInTheDocument();
    expect(queryByText('Replaced Content')).toBeInTheDocument();
  });

  it('should update text on button click using state and effects', () => {
    const stateFn = vi.fn((state, setState) => {
      if (state.clicked === undefined) {
        setState((state: any) => ({ ...state, clicked: false }));
      }
    });

    const effectFn = vi.fn((state, setState) => {
      if (state.clicked && !state.status) {
        setState((state: any) => ({ ...state, status: 'Clicked!' }));
      }
    });

    const onClickFn = vi.fn((setState) => setState?.({ clicked: true }));

    const handlerFn = vi.fn((handlers, state, setState) => ({
      ...handlers,
      component: {
        ...handlers.component,
        onClick: () => onClickFn(setState),
      },
    }));

    const Component = ComponentBuilder.use(MockComponent)
      .addState(stateFn)
      .updateHandlers(handlerFn)
      .addEffects((state, setState) => [
        {
          effect: () => effectFn(state, setState),
          dependencies: [state?.['clicked']],
        },
      ])
      .updateHTML((children, state, handlers) => (
        <>
          {children}
          <div>{Object.keys(handlers ?? {})}</div>
          <button onClick={handlers?.['onClick']}>Click me</button>
          <div>{state?.['status'] as string}</div>
        </>
      ))
      .build();

    const { getByText } = render(<Component text="Hello" />);
    const button = getByText('Click me');

    fireEvent.click(button);

    expect(handlerFn).toHaveBeenCalled();
    expect(onClickFn).toHaveBeenCalled();
    expect(stateFn).toHaveBeenCalled();
    expect(effectFn).toHaveBeenCalled();
    expect(getByText('Clicked!')).toBeInTheDocument();
  });
});
