## ADDED Requirements

### Requirement: Folder markers are hidden from the Content tab

`buildSkillContentTree` (`libs/chat-hooks/src/catalog/map-skill-to-catalog-item.ts`) SHALL treat a `nodeType: 'item'` listing entry whose name is `.dial_folder` (`HIDDEN_FILE` from `@epam/ai-dial-chat-shared`) as proof that its parent folder exists. It SHALL create the parent folder chain from the entry's stripped path, as for a `nodeType: 'folder'` entry, and SHALL NOT emit a `CatalogContentFileNode` for it. A marker directly under the skill root (stripped parent is empty) SHALL contribute nothing.

Since the marker never becomes a file node, the Content tab's "N files" count (`countFileNodes` in `libs/catalog`) does not include it, the tree never shows a `.dial_folder` row, and the marker can never be selected or previewed. `libs/catalog` and `libs/skills` are unchanged and SHALL NOT learn the marker name.

#### Scenario: A marked empty folder appears empty
- **WHEN** the listing returns `SKILL.md` and an item `docs/.dial_folder`
- **THEN** `promptContent.files` has root entries `SKILL.md` and a `docs` folder node whose `items` is empty

#### Scenario: The marker is not counted
- **WHEN** the listing returns `SKILL.md`, `docs/.dial_folder` and `scripts/run.py`
- **THEN** the Content tab trigger reports 2 files

#### Scenario: A Core-prefixed marker is still hidden
- **WHEN** the listing returns the item `{skillPath}/files/docs/.dial_folder`
- **THEN** the tree contains a `docs` folder node and no node named `.dial_folder`
