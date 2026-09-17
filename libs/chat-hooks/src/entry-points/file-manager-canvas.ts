/*
 * The attachment-canvas content resolvers and their DIAL-file blob/text LRU
 * caches live behind their own entry so `./file-manager` — imported for
 * ordinary file browsing, upload and naming helpers — carries no static
 * import of the optional `@epam/ai-dial-attachment-canvas` and
 * `@epam/ai-dial-quotations` peers
 * ([issue #8855](https://github.com/epam/ai-dial-chat/issues/8855)).
 */
export * from '../files/attachment-canvas';
