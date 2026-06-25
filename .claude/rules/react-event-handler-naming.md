---
description: React event callback and handler naming convention
globs: '**/*.tsx'
alwaysApply: false
---

# React Event Handler Naming

- Event callback props exposed by React components use `onEvent` names:
  `onSubmit`, `onClose`, `onKeyDown`.
- Handler functions declared inside a component use `handleEvent` names:
  `handleSubmit`, `handleClose`, `handleKeyDown`.
- When adapting a prop callback inside a component, keep the external prop as
  `onEvent` and call it from the local `handleEvent` function.

```tsx
type DialogProps = {
  onClose: () => void;
};

const Dialog: FC<DialogProps> = ({ onClose }) => {
  const handleClose = () => {
    onClose();
  };

  return <button onClick={handleClose}>Close</button>;
};
```
