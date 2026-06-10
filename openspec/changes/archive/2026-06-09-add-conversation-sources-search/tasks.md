## 1. i18n Translation Keys

- [x] 1.1 Add `conversationSourcesPanel.searchPlaceholder` → `"Search files…"` to `apps/chat/src/i18n/locales/en.json`
- [x] 1.2 Add `conversationSourcesPanel.noResults` → `"No results found"` to `apps/chat/src/i18n/locales/en.json`

## 2. ConversationSourcesPanel — Search State & Filtering

- [x] 2.1 Add `const [searchQuery, setSearchQuery] = useState('')` inside `ConversationSourcesPanel`
- [x] 2.2 Add a `useEffect` that resets `searchQuery` to `''` when `isOpen` becomes `false`
- [x] 2.3 Derive `filteredUploaded` and `filteredGenerated` by filtering each array with a case-insensitive `title`/`name` substring match against `searchQuery`

## 3. ConversationSourcesPanel — Render SearchInput

- [x] 3.1 Import `SearchInput` from `libs/sidebar/src/components/SearchInput/SearchInput`
- [x] 3.2 Render `<SearchInput>` in the panel header, passing the translated placeholder, `value={searchQuery}`, and `onChange={setSearchQuery}`
- [x] 3.3 Remove (or replace) the existing disabled search icon button that was the placeholder

## 4. ConversationSourcesPanel — No Results Empty State

- [x] 4.1 When `searchQuery` is non-empty and both `filteredUploaded` and `filteredGenerated` are empty, render the translated "No results found" message instead of the `FilesSection` components
- [x] 4.2 Pass `filteredUploaded` and `filteredGenerated` (instead of `uploaded`/`generated`) to the two `FilesSection` components for all other cases

## 5. Verification

- [ ] 5.1 Open the sources panel with several uploaded and generated attachments; confirm typing a partial name filters both sections
- [ ] 5.2 Confirm that a query matching nothing shows "No results found" and no file sections
- [ ] 5.3 Clear the query; confirm all attachments reappear
- [ ] 5.4 Close the panel with a query typed; re-open; confirm the search input is empty
- [x] 5.5 Run `npm exec nx lint conversation-sources-panel` (or the affected lint target) and confirm no errors
