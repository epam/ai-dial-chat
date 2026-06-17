---
paths:
  - '**/utils/**/*.ts'
  - '**/utils/**/*.tsx'
globs: '**/utils/**/*.ts,**/utils/**/*.tsx'
applyTo: '**/utils/**/*.ts,**/utils/**/*.tsx'
alwaysApply: false
---

# Utils conventions

Prefer arrow-function declarations over `function` declarations:

```ts
// Correct
const formatDate = (date: Date): string => { ... };

// Wrong
function formatDate(date: Date): string { ... }
```
