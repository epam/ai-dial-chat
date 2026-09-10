/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const { dirname, join } = require('path');

const { writeFileSync, readFileSync } = require('fs');

/**
 * Replace content in a node module file
 * @param {string} moduleName - name of the module
 * @param {string} relativeFilePath - the relative path to the file inside the module
 * @param {RegExp} searchPattern - regular expression to search for the content to replace
 * @param {string} replacement - the content to replace with
 */
function replaceContentInNodeModule(
  next,
  relativeFilePath,
  searchPattern,
  replacement,
) {
  const modulePath = dirname(
    require.resolve(`../node_modules/${next}/package.json`),
  );
  const targetFilePath = join(modulePath, relativeFilePath);

  let fileContent;
  let updatedContent;
  try {
    fileContent = readFileSync(targetFilePath, 'utf-8');
    updatedContent = fileContent.replaceAll(searchPattern, replacement);
  } catch (e) {
    console.error(`Error reading file: ${targetFilePath}`, e);
    throw e;
  }

  // A silent no-op means the upstream source drifted (e.g. after a Next.js
  // upgrade) and the behaviour this patch provides is gone. Fail loudly unless
  // the replacement is already in place from a previous run.
  if (updatedContent === fileContent && !fileContent.includes(replacement)) {
    throw new Error(
      `Patch target not found in ${targetFilePath}\n` +
        `  searched for: ${searchPattern}\n` +
        `  This usually means the dependency was upgraded and the patch needs to be updated.`,
    );
  }

  try {
    writeFileSync(targetFilePath, updatedContent, 'utf-8');
  } catch (e) {
    console.error(`Error writing updates to file: ${targetFilePath}`, e);
    throw e;
  }
  console.log(`Content replaced in file: ${targetFilePath}`);
}

// Make it possible to change basePath after build with new process.env.APP_BASE_PATH variable
replaceContentInNodeModule(
  'next',
  'dist/shared/lib/router/utils/path-has-prefix.js',
  'pathname === prefix',
  'pathname == prefix',
);

replaceContentInNodeModule(
  'next',
  'dist/server/config.js',
  "if (typeof result.basePath !== 'string')",
  'if (false)',
);

replaceContentInNodeModule(
  'next',
  'dist/server/config.js',
  "if (!result.basePath.startsWith('/'))",
  'if (false)',
);

replaceContentInNodeModule(
  'next',
  'dist/server/config-schema.js',
  'basePath: _zod.z.string().optional()',
  'basePath: _zod.z.string().or(_zod.z.record(_zod.z.any())).optional()',
);

replaceContentInNodeModule(
  'next',
  'dist/build/webpack/loaders/next-font-loader/index.js',
  'if (assetPrefix && !/^\\/|https?:\\/\\//.test(assetPrefix))',
  'if (false)',
);

replaceContentInNodeModule(
  'next',
  'dist/lib/load-custom-routes.js',
  'if (config.basePath) {',
  'if (config.basePath.toString()) {',
);

replaceContentInNodeModule(
  'next',
  'dist/server/lib/router-utils/resolve-routes.js',
  '_nodepath.default.posix.join(config.basePath, normalized);',
  '_nodepath.default.posix.join(config.basePath.toString(), normalized);',
);

replaceContentInNodeModule(
  'next-auth',
  'core/lib/callback-url.js',
  'baseUrl: url.origin',
  `baseUrl: '' + url.origin + (process.env.APP_BASE_PATH || '')`,
);

// Fix RxJs issue in innerFrom, when an observable is not recognized as an instance of Observable and throws an exception,
// although it has lift and subscribe methods, therefore it should be considered as an Observable
// as a workaround, here in the code is the factual replacement of "input instanceof Observable" with one-liner of "isObservable(input)"
replaceContentInNodeModule(
  'rxjs',
  'dist/esm/internal/observable/innerFrom.js',
  'if (input instanceof Observable) {',
  `if (!!input && (input instanceof Observable || (typeof input.lift === 'function' && typeof input.subscribe === 'function'))) {`,
);

replaceContentInNodeModule(
  'rxjs',
  'dist/esm5/internal/observable/innerFrom.js',
  'if (input instanceof Observable) {',
  `if (!!input && (input instanceof Observable || (typeof input.lift === 'function' && typeof input.subscribe === 'function'))) {`,
);

replaceContentInNodeModule(
  'rxjs',
  'dist/cjs/internal/observable/innerFrom.js',
  'if (input instanceof Observable_1.Observable) {',
  `if (!!input && (input instanceof Observable_1.Observable || (typeof input.lift === 'function' && typeof input.subscribe === 'function'))) {`,
);

// NOTE: The patches that enabled server-side debugging on a custom host (e.g.
// 0.0.0.0) were removed in the Next.js 16.3.4 upgrade. Next.js now supports a
// `[host:]port` debug address natively via `getParsedDebugAddress` /
// `formatDebugAddress` in `dist/server/lib/utils.js`, which preserves the host
// and increments the port, so the patches were no longer needed.
