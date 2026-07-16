/**
 * Shared runtime enum backing the six structurally-identical
 * `{ Item = 'item', Folder = 'folder' }` node-type enums declared across the
 * files DTOs (`CopyItemNodeType`, `DeleteItemNodeType`, `MoveItemNodeType`,
 * `RenameItemNodeType`, `ArchiveItemNodeType`, `FileNodeType`). Each DTO file
 * keeps its own exported name as an alias to this enum so Swagger schema
 * names (and therefore `@epam/chat-api-client`) do not change.
 */
export enum DialFileNodeType {
  Item = 'item',
  Folder = 'folder',
}
