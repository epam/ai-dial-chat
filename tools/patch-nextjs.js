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

  let updatedContent;
  try {
    const fileContent = readFileSync(targetFilePath, 'utf-8');
    updatedContent = fileContent.replaceAll(searchPattern, replacement);
  } catch (e) {
    console.error(`Error reading file: ${targetFilePath}`, e);
    throw e;
  }
  try {
    writeFileSync(targetFilePath, updatedContent, 'utf-8');
  } catch (e) {
    console.error(`Error writing updates to file: ${targetFilePath}`, e);
    throw e;
  }
  console.log(`Content replaced in file: ${targetFilePath}`);
}

replaceContentInNodeModule(
  'next',
  'dist/shared/lib/router/utils/path-has-prefix.js',
  'pathname === prefix',
  'pathname == prefix',
);

replaceContentInNodeModule(
  'next',
  'dist/server/config.js',
  'if (typeof result.basePath !== "string")',
  'if (false)',
);

replaceContentInNodeModule(
  'next',
  'dist/server/config.js',
  'if (!result.basePath.startsWith("/"))',
  'if (false)',
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
  'next-auth',
  'core/lib/callback-url.js',
  'baseUrl: url.origin',
  `baseUrl: '' + url.origin + (process.env.APP_BASE_PATH || '')`,
);
