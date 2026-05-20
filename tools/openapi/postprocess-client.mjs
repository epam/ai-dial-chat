import { readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const generatedRoot = 'libs/chat-api-client/src/generated';
const generatedApisRoot = join(generatedRoot, 'src/apis');

await Promise.all(
  ['package.json', 'tsconfig.json', 'tsconfig.esm.json'].map((file) =>
    rm(join(generatedRoot, file), { force: true }),
  ),
);

const apiFiles = await readdir(generatedApisRoot);

await Promise.all(
  apiFiles
    .filter((file) => file.endsWith('.ts'))
    .map(async (file) => {
      const path = join(generatedApisRoot, file);
      const source = await readFile(path, 'utf8');
      const updated = source
        .replaceAll(
          'const queryParameters: any = {};',
          'const queryParameters: runtime.HTTPQuery = {};',
        )
        .replaceAll(
          'return new runtime.TextApiResponse(response) as any;',
          'return new runtime.TextApiResponse(response);',
        );

      if (updated !== source) {
        await writeFile(path, updated);
      }
    }),
);
