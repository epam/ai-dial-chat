## 1. Update CodeBlock Component

- [x] 1.1 In `apps/chat/src/components/Markdown/CodeBlock.tsx`, change the outer wrapper `div.codeblock` class from `overflow-hidden` to `overflow-auto` to make it the scroll container for sticky positioning
- [x] 1.2 Add `sticky top-0 z-10` Tailwind classes to the header `div` (the one with `data-qa="code-title-container"`) so it pins to the top of the scroll container while the user scrolls through code

## 2. Verify and Test

- [x] 2.1 Start the dev server (`npm run nx serve chat`) and manually verify that the header stays visible when scrolling through a long code block in a chat message
- [x] 2.2 Confirm that multiple code blocks on the same page each have their own independent sticky header (no bleed between blocks)
- [x] 2.3 Confirm that the header background correctly covers underlying code text (no transparency issue) in both light and dark themes
- [x] 2.4 Run linting and formatting: `npm run lint:fix && npm run format:fix`
