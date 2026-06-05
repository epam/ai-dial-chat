import { readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const generatedRoot = 'libs/chat-api-client/src/generated';
const generatedApisRoot = join(generatedRoot, 'src/apis');
const generatedModelsRoot = join(generatedRoot, 'src/models');
const generatedRuntimePath = join(generatedRoot, 'src/runtime.ts');

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

      // Add explicit type args to JSONApiResponse so TypeScript does not
      // infer T = any from the identity default transformer.
      // The Raw method is always annotated with the return type on the line
      // immediately before `return new runtime.JSONApiResponse(response);`.
      // Example:
      //   ): Promise<runtime.ApiResponse<FooDto>> {   ← captures FooDto
      //       ...
      //       return new runtime.JSONApiResponse(response);
      //
      // We walk the lines and substitute using the last seen ApiResponse type.
      const lines = source.split('\n');
      let lastApiResponseType = '';
      const patched = lines
        .map((line) => {
          const apiResponseMatch = line.match(
            /\):\s*Promise<runtime\.ApiResponse<((?:[^<>]|<[^<>]*>)*)>>/,
          );
          if (apiResponseMatch) {
            lastApiResponseType = apiResponseMatch[1];
          }
          if (
            line.includes('return new runtime.JSONApiResponse(response)') &&
            lastApiResponseType
          ) {
            return line.replace(
              'return new runtime.JSONApiResponse(response)',
              `return new runtime.JSONApiResponse<${lastApiResponseType}>(response)`,
            );
          }
          return line;
        })
        .join('\n');

      const updated = patched
        .replaceAll(
          'const queryParameters: any = {};',
          'const queryParameters: runtime.HTTPQuery = {};',
        )
        .replaceAll(
          'return new runtime.TextApiResponse(response) as any;',
          'return new runtime.TextApiResponse(response);',
        )
        // Fix multipart/form-data generator gap: replace untyped formParams declaration.
        // Method-shorthand syntax is bivariant in TypeScript, so URLSearchParams (string-only
        // append) and FormData (string | Blob append) both satisfy this interface.
        .replaceAll(
          'let formParams: { append(param: string, value: any): any };',
          'let formParams: { append(name: string, value: string | Blob): void };',
        )
        // Fix multipart/form-data generator gap: remove `as any` from formParams.append calls
        .replace(
          /formParams\.append\(([^,]+),\s*([^)]+)\s+as\s+any\)/g,
          'formParams.append($1, $2)',
        )
        // Replace loose object index-signature any in API return types and response wrappers
        .replace(/\{ \[key: string\]: any;? \}/g, '{ [key: string]: unknown }')
        // Replace JSONApiResponse<any> where the generator emitted an explicit any type arg
        .replaceAll(
          'return new runtime.JSONApiResponse<any>(response);',
          'return new runtime.JSONApiResponse<{ [key: string]: unknown }>(response);',
        );

      if (updated !== source) {
        await writeFile(path, updated);
      }
    }),
);

const modelFiles = await readdir(generatedModelsRoot);

await Promise.all(
  modelFiles
    .filter((file) => file.endsWith('.ts'))
    .map(async (file) => {
      const path = join(generatedModelsRoot, file);
      const source = await readFile(path, 'utf8');
      const updated = source.replace(
        /\{ \[key: string\]: any;? \}/g,
        '{ [key: string]: unknown }',
      );

      if (updated !== source) {
        await writeFile(path, updated);
      }
    }),
);

const runtimeSource = await readFile(generatedRuntimePath, 'utf8');
const runtimeUpdated = runtimeSource.replace(
  'return value !== null && value !== undefined;',
  'return value != null;',
);

if (runtimeUpdated !== runtimeSource) {
  await writeFile(generatedRuntimePath, runtimeUpdated);
}
