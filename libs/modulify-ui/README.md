# Modulify Toolkit (UI)

## Modulify-UI: Enhancing React Component Flexibility and Customization

Modulify-UI is a React library comprised of two powerful tools, **Inversify** and **ComponentBuilder**, designed to enhance component flexibility and simplify complex customization processes.

**In short:**

- **Inversify:** Decouple component implementations for easy swapping and conflict-free customization of forked code.
- **ComponentBuilder:** Structure component building with fine-grained control over state, styles, HTML, and more.

Whether you're looking to manage multiple implementations of a component, streamline customizations, or structure your component logic for better maintainability, Modulify-UI's tools offer effective solutions to simplify your React development workflow.

### Inversify: Dynamic Component Swapping

**Key Features:**

- Register original components for later customization.
- Resolve registered components and bind new implementations at runtime.
- Seamlessly swap component implementations without modifying original source code.

**Inversify** facilitates the decoupling of component implementations from their usage. By registering the original component and then binding a new implementation to it at runtime, developers gain precise control over component rendering without introducing tight coupling or code entanglement. This is particularly useful for:

- A/B testing different component variations.
- Feature toggling to enable or disable specific implementations.
- Adapting component behavior based on context (e.g., user roles, device type).
- Customizing components in forked codebases without creating merge conflicts.

#### Example

Let's say you have a core `Button` component in your application that's used across various features. You anticipate needing to customize its behavior or appearance in the future without directly modifying the original component file to maintain a clean core codebase.

```tsx
import Inversify from './path/to/Inversify';

import { FC } from 'react';

interface ButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

// Wrap the Button component with Inversify.register
// This allows for future customizations without modifying this file
const Button: FC<ButtonProps> = Inversify.register('Button', ({ onClick, variant, children }) => (
  <button onClick={onClick} className={`button ${variant}`}>
    {children}
  </button>
));

// ...later in your application code...

const resolvedButton = Inversify.resolve(Button.original);

// Conditionally bind a different implementation, e.g., for A/B testing
if (Math.random() > 0.5) {
  resolvedButton.bind((originalButton) => (props) => {
    const { variant, ...restProps } = props;
    return <originalButton {...restProps} variant={variant === 'primary' ? 'secondary' : 'primary'} />;
  });
}

// Render the button with the bound implementation
const renderedButton = resolvedButton.render();

const App = () => {
  return (
    <div>
      <renderedButton onClick={() => console.log('Clicked!')} variant="primary">
        Click me
      </renderedButton>
    </div>
  );
};

export default App;
```

In this example, the `bind` method provides the original `Button` component as an argument to the factory function, allowing you to render it with modified props. This demonstrates how you can subtly change the behavior or appearance of a component without altering its core implementation.

#### `Inversify.register(name: string, component: OC)`

Registers a React component, associating it with a provided name. The name is primarily used for debugging and does not affect the registration itself. Importantly, registration is done using the component's function reference, and only one original component can be registered for a given function.

```tsx
// Registering the original component with Inversify
const MyComponent = Inversify.register('MyComponent', OriginalComponent);
```

#### `Inversify.resolve(component: OC)`

Provides an interface to interact with a registered component. It returns an object with methods to:

- Access the original registered component via the `original` property.
- Retrieve the currently active implementation (original or bound) using `instance()`.
- Bind a new implementation using `bind(factory)`. This method accepts a factory function that receives the original component as an argument and should return a new component implementation. Each call to `bind` replaces the previous factory, ensuring that only one active implementation is in effect at a time.
- Unbind the current implementation, reverting to the original component, with `unbind()`.
- Render the component, potentially with the bound implementation, using `render()`.

```tsx
// Accessing the original component and binding a new implementation
const RenderedComponent = Inversify.resolve(MyComponent.original)
  .bind((originalComponent) => (props) => (
    // Accessing and using the original component within the factory
    <div style={{ border: '2px solid red' }}>
      <originalComponent {...props} />
    </div>
  ))
  .render();

// If you need to revert to the original component, unbind to the original
Inversify.resolve(MyComponent.original).unbind();
```

### ComponentBuilder: Structured Component Customization

**Key Features:**

- Manage state, styles, HTML structure, event handlers, and side effects in a structured manner.
- Chain customization methods for a fluent coding style.
- Target styles and classes to both the component and a wrapping "host" element.

**ComponentBuilder** introduces a structured pattern for building React components, promoting maintainability and simplifying complex customizations.

#### Example

```tsx
import ComponentBuilder from './path/to/ComponentBuilder';

import React, { FC } from 'react';

const MyComponent: FC = () => (
  <div>
    <span data-customize-id="my-text">Hello, world!</span>
  </div>
);

const CustomizedComponent = ComponentBuilder.use(MyComponent)
  .updateClassNames((classNames) => ({
    // These classes will be applied to a wrapping <div>
    host: ['custom-class', classNames.host].flat(),
    // These classes will be applied to the <MyComponent> element
    component: ['another-class'],
  }))
  .updateStyles((styles) => ({
    host: {
      backgroundColor: 'lightblue',
      ...styles.host,
      '&:hover': {
        // CSS selector targeting the host element
        backgroundColor: 'blue',
      },
    },
    component: {
      fontSize: '2em', // Styles applied directly to the component
    },
  }))
  .updateHTML({
    'my-text': (children) => <a href="#">{children}</a>,
  })
  .build();
```

#### `ComponentBuilder.use(component: Component)`

Initializes a new `ComponentBuilder` instance for a given React component, enabling subsequent customization methods to be chained.

```tsx
const builder = ComponentBuilder.use(MyComponent);
```

**ComponentBuilder** provides fine-grained control over styling and class names. You can target both the component itself and a wrapping `div` element (referred to as the "host"). This is achieved using the `component` and `host` properties within the styling and class name functions.

- **Styling and Classes for the Component:** When you define styles or class names under the `component` property, they are applied directly to the root element of your component. This ensures style isolation as generated CSS class names are unique to the component.

- **Styling and Classes for the Host (Wrapper):** If you need to apply styles or classes to a wrapping `div` element, use the `host` property. This is useful for controlling the layout or appearance of the component within its parent container.
- In most cases you don't need to add a wrapping `div` element to your component and therefore you shouldn't need to use the `host` property.

#### `updateClassNames(updateFn)`

Provides a mechanism to dynamically update the CSS classes applied to a component based on its state or other factors.

```tsx
builder.updateClassNames((classNames, state) => ({
  host: state.isActive ? 'active' : 'inactive', // Applied to a wrapping <div>
  component: 'my-component', // Applied to the component itself
}));
```

#### `updateStyles(updateFn)`

Allows for the dynamic application and modification of inline styles in response to changes in component state or props. This method leverages `react-jss` under the hood, providing the flexibility to define styles for specific CSS selectors as well.

```tsx
builder.updateStyles((styles, state) => ({
  host: {
    backgroundColor: state.isActive ? 'blue' : 'gray',
    '&:hover': {
      // CSS selector targeting the host element
      opacity: 0.8,
    },
  },
  component: {
    // Styles applied directly to the component
    fontSize: '1.2em',
  },
}));
```

#### `updateHTML(htmlContentFnOrBlocks)`

Enables the modification of a component's internal HTML structure, allowing for the addition, removal, or modification of elements based on specific conditions. You can provide either a single function to modify the entire HTML structure or a map of functions to target specific elements identified by the `data-customize-id` attribute.

```tsx
// Modifying the entire HTML structure
builder.updateHTML((children, state) => (
  <>
    {state.showHeader && <h1>Header</h1>}
    {children}
  </>
));

// Targeting specific elements by data-customize-id
builder.updateHTML({
  'my-element-id': (children) => <div className="custom-style">{children}</div>,
});
```

#### `updateHandlers(updateFn)`

Provides a way to manage event handlers associated with a component, allowing for dynamic behavior based on state changes or external events.

```tsx
builder.updateHandlers((handlers, state, setState) => ({
  host: {
    onClick: () => setState({ isActive: !state.isActive }),
  },
}));
```

#### `addState(stateFn)`

Introduces state management capabilities to a component, allowing it to maintain and update its internal data.

```tsx
builder.addState((state, setState) => {
  // Initialize state
  if (!state.count) {
    setState({ count: 0 });
  }

  // Expose a method to update the state
  return {
    increment: () => setState((prevState) => ({ count: prevState.count + 1 })),
  };
});
```

#### `addEffects(effectsFn)`

Facilitates the integration of side effects into a component's lifecycle, such as data fetching, API interactions, or direct DOM manipulations.

```tsx
builder.addEffects((state) => [
  {
    effect: () => {
      console.log('Component mounted!');
    },
    dependencies: [],
  },
]);
```

#### `build(options)`

Finalizes the component building process, consolidating all applied customizations and returning a new, enhanced React component ready for use.

```tsx
const CustomizedComponent = builder.build();
```

### Combining Inversify and ComponentBuilder for Advanced Customization

This example demonstrates how to combine the power of Inversify and ComponentBuilder to achieve advanced component customization in a clean and maintainable way.

```tsx
import ComponentBuilder from './path/to/ComponentBuilder';
import Inversify from './path/to/Inversify';

import React, { FC } from 'react';

interface MyComponentProps {
  title: string;
}

const MyComponent: FC<MyComponentProps> = Inversify.register('MyComponent', ({ title }) => (
  <div>
    <h1>{title}</h1>
    <p data-customize-id="content">Default content</p>
  </div>
));

Inversify.resolve(MyComponent.original).bind((originalComponent) =>
  ComponentBuilder.use(originalComponent)
    .updateStyles(() => ({
      component: {
        border: '1px solid blue',
        padding: '10px',
      },
    }))
    .updateHTML({
      content: () => <span>Customized content!</span>,
    })
    .build(),
);

// IMPORTANT: From this point onwards, any usage of MyComponent will
// actually render the customized version created by ComponentBuilder.
```

**Explanation:**

1. **Registration:** We start by wrapping our `MyComponent` with `Inversify.register`, making it customizable.
2. **Resolution and Binding:** We use `Inversify.resolve` to access the registered component and then chain the `bind` method.
3. **ComponentBuilder Customization:** Inside the `bind` method's factory function, we use `ComponentBuilder` to:
   - Add a blue border and padding to the component's root element using `updateStyles`.
   - Replace the content of the `p` tag marked with `data-customize-id="content"` using `updateHTML`.
4. **Implicit Replacement:** The crucial point here is that we don't explicitly call `render()` after the `bind` operation. This means that Inversify will seamlessly replace all future instances of the original `MyComponent` with our customized version.

This combined approach not only allows you to leverage Inversify's implementation swapping capabilities while harnessing the structured customization features of ComponentBuilder but also highlights how Inversify can be used for implicit, application-wide component modifications.

---

In conclusion, **Inversify** and **ComponentBuilder** offer powerful mechanisms to enhance the flexibility, maintainability, and customization potential of your React components. By providing tools to manage implementations, structure component logic, and simplify complex customizations, these libraries streamline the development process and promote code clarity, ultimately leading to more robust and adaptable React applications.

## Contributing

We welcome contributions from the community to help make Modulify-UI even better! Whether you've found a bug, have an idea for an enhancement, or want to contribute code, we encourage you to get involved.

- **Bug Reports:** If you encounter any issues or unexpected behavior, please open an issue on our GitHub repository with a clear description of the problem and steps to reproduce it.
- **Feature Requests:** Have a great idea for a new feature or improvement? Feel free to open an issue to discuss it with the community.
- **Code Contributions:** We welcome pull requests for bug fixes, new features, or documentation improvements. Please ensure your code follows the existing style guidelines and includes appropriate tests.

We appreciate your contributions and look forward to building a robust and versatile UI toolkit together!
