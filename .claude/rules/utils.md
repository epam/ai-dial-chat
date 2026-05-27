---
paths:
  - "**/utils/**/*.ts"
  - "**/utils/**/*.tsx"
---

# Utils conventions

Prefer arrow-function declarations over `function` declarations:

```ts
// ✅
const formatDate = (date: Date): string => { ... };

// ❌
function formatDate(date: Date): string { ... }
```
