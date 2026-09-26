export * from './attach-result';
export * from './file-manager-controller';
export * from './file-manager-variant';
export * from './file-upload-validation';
export * from './labels';
export * from './path';
export * from './upload-batch';
export * from './useGridEditingScroll/useGridEditingScroll';
export * from './OperationLoaderModal/OperationLoaderModal';

/*
 * `DialFileManagerShell` and `FileManagerAttachModal` are deliberately absent:
 * they are the only modules here that *render* the grid, so they are the only
 * ones whose import of `@epam/ai-dial-react-file-manager` a bundler has to
 * resolve. This barrel is reached from the root entry (`src/index.ts`), so
 * exporting them here would put that import in the closure of every host that
 * imports this package at all — which is what made the "optional peer, scoped
 * to `./file-manager`" promise in the README untrue
 * ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)). Both
 * components are exported from the `./file-manager` entry
 * (`src/entry-points/file-manager.ts`), which is where a host that installs
 * the grid imports them from. Everything left in this barrel touches the grid
 * in type position only, which erases at build time.
 */
