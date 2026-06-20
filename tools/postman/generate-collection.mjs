import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { format } from 'prettier';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');
const openApiPath = resolve(workspaceRoot, 'libs/chat-api-client/openapi.json');
const outputPath = resolve(
  workspaceRoot,
  'postman/chat-api.postman_collection.json',
);
const httpMethods = new Set([
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace',
]);
const unsafeMethods = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

const openApi = JSON.parse(await readFile(openApiPath, 'utf8'));

const resolveReference = (reference) => {
  if (!reference?.startsWith('#/')) return undefined;

  return reference
    .slice(2)
    .split('/')
    .reduce(
      (value, segment) =>
        value?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')],
      openApi,
    );
};

const resolveSchema = (schema) => {
  if (!schema) return {};
  if (schema.$ref) return resolveReference(schema.$ref) ?? {};
  return schema;
};

const mergeAllOf = (schemas) =>
  schemas.reduce(
    (result, schema) => {
      const resolved = resolveSchema(schema);
      return {
        ...result,
        ...resolved,
        required: [
          ...new Set([
            ...(result.required ?? []),
            ...(resolved.required ?? []),
          ]),
        ],
        properties: {
          ...(result.properties ?? {}),
          ...(resolved.properties ?? {}),
        },
      };
    },
    { properties: {}, required: [] },
  );

const valueForName = (name, fallback) => {
  const variableNames = new Set([
    'bucket',
    'callbackUrl',
    'deployment',
    'id',
    'modelName',
    'path',
    'providerId',
  ]);

  return variableNames.has(name) ? `{{${name}}}` : fallback;
};

const createExample = (inputSchema, name = '', seen = new Set()) => {
  let schema = resolveSchema(inputSchema);
  const reference = inputSchema?.$ref;

  if (reference) {
    if (seen.has(reference)) return {};
    seen = new Set(seen).add(reference);
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.allOf) schema = mergeAllOf(schema.allOf);
  if (schema.oneOf?.length) return createExample(schema.oneOf[0], name, seen);
  if (schema.anyOf?.length) return createExample(schema.anyOf[0], name, seen);

  if (schema.type === 'array' || schema.items) {
    return [createExample(schema.items ?? {}, name, seen)];
  }

  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(
        ([propertyName, property]) => [
          propertyName,
          createExample(property, propertyName, seen),
        ],
      ),
    );
  }

  const fallback = (() => {
    switch (schema.type) {
      case 'boolean':
        return false;
      case 'integer':
      case 'number':
        return schema.minimum ?? 0;
      case 'string':
      default:
        if (schema.format === 'date') return '2026-01-01';
        if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uri' || schema.format === 'url') {
          return 'https://example.com';
        }
        return name || 'string';
    }
  })();

  return valueForName(name, fallback);
};

const collectParameters = (pathItem, operation) => {
  const parameters = [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ];
  const unique = new Map();

  for (const parameterOrReference of parameters) {
    const parameter = parameterOrReference.$ref
      ? resolveReference(parameterOrReference.$ref)
      : parameterOrReference;
    if (parameter) unique.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  return [...unique.values()];
};

const getParameterValue = (parameter) =>
  String(
    valueForName(
      parameter.name,
      parameter.example ??
        parameter.schema?.example ??
        createExample(parameter.schema, parameter.name),
    ),
  );

const createBody = (operation) => {
  const requestBody = operation.requestBody?.$ref
    ? resolveReference(operation.requestBody.$ref)
    : operation.requestBody;
  const content = requestBody?.content ?? {};

  if (content['application/json']) {
    return {
      mode: 'raw',
      raw: `${JSON.stringify(
        createExample(content['application/json'].schema),
        null,
        2,
      )}\n`,
      options: { raw: { language: 'json' } },
    };
  }

  if (content['multipart/form-data']) {
    const schema = resolveSchema(content['multipart/form-data'].schema);
    const required = new Set(schema.required ?? []);
    return {
      mode: 'formdata',
      formdata: Object.entries(schema.properties ?? {}).map(
        ([name, property]) => ({
          key: name,
          type: property.format === 'binary' ? 'file' : 'text',
          ...(property.format === 'binary'
            ? { src: [] }
            : { value: String(createExample(property, name)) }),
          ...(required.has(name) ? {} : { disabled: true }),
        }),
      ),
    };
  }

  if (content['application/x-www-form-urlencoded']) {
    const schema = resolveSchema(
      content['application/x-www-form-urlencoded'].schema,
    );
    const required = new Set(schema.required ?? []);
    return {
      mode: 'urlencoded',
      urlencoded: Object.entries(schema.properties ?? {}).map(
        ([name, property]) => ({
          key: name,
          value: String(createExample(property, name)),
          type: 'text',
          ...(required.has(name) ? {} : { disabled: true }),
        }),
      ),
    };
  }

  return undefined;
};

const getAcceptHeader = (operation) => {
  const successfulResponse = Object.entries(operation.responses ?? {}).find(
    ([status]) => status.startsWith('2'),
  )?.[1];
  const response = successfulResponse?.$ref
    ? resolveReference(successfulResponse.$ref)
    : successfulResponse;
  return Object.keys(response?.content ?? {})[0] ?? 'application/json';
};

const createRequest = (path, pathItem, method, operation) => {
  const upperMethod = method.toUpperCase();
  const parameters = collectParameters(pathItem, operation);
  const pathParameters = parameters.filter(
    (parameter) => parameter.in === 'path',
  );
  const queryParameters = parameters.filter(
    (parameter) => parameter.in === 'query',
  );
  const headers = parameters
    .filter((parameter) => parameter.in === 'header')
    .map((parameter) => ({
      key: parameter.name,
      value: getParameterValue(parameter),
      ...(parameter.required ? {} : { disabled: true }),
    }));

  headers.unshift({ key: 'Accept', value: getAcceptHeader(operation) });
  if (unsafeMethods.has(upperMethod)) {
    headers.push(
      { key: 'Origin', value: '{{origin}}' },
      { key: 'X-CSRF-Token', value: '{{csrfToken}}' },
    );
  }
  const body = createBody(operation);

  let requestPath = path;
  for (const parameter of pathParameters) {
    requestPath = requestPath.replace(
      `{${parameter.name}}`,
      `{{${parameter.name}}}`,
    );
  }
  const query = queryParameters.map((parameter) => ({
    key: parameter.name,
    value: getParameterValue(parameter),
    ...(parameter.required ? {} : { disabled: true }),
    ...(parameter.description ? { description: parameter.description } : {}),
  }));
  const requiredQueryString = query
    .filter((parameter) => !parameter.disabled)
    .map((parameter) => `${parameter.key}=${parameter.value}`)
    .join('&');

  const description = [
    operation.description,
    operation.security?.length
      ? 'Authentication: session cookie (managed automatically by the Postman cookie jar).'
      : undefined,
    unsafeMethods.has(upperMethod)
      ? 'CSRF: run an authenticated GET request first (for example “Get current user”) so the collection captures X-CSRF-Token.'
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    name:
      operation.summary ?? operation.operationId ?? `${upperMethod} ${path}`,
    request: {
      method: upperMethod,
      header: headers,
      ...(body ? { body } : {}),
      url: {
        raw: `{{baseUrl}}${requestPath}${requiredQueryString ? `?${requiredQueryString}` : ''}`,
        host: ['{{baseUrl}}'],
        path: requestPath.split('/').filter(Boolean),
        ...(query.length ? { query } : {}),
      },
      ...(description ? { description } : {}),
    },
  };
};

const folders = new Map();
let requestCount = 0;

for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue;

    const folderName = operation.tags?.[0] ?? 'Other';
    const folder = folders.get(folderName) ?? {
      name: folderName,
      item: [],
    };
    folder.item.push(createRequest(path, pathItem, method, operation));
    folders.set(folderName, folder);
    requestCount += 1;
  }
}

const variables = [
  ['baseUrl', openApi.servers?.[0]?.url ?? 'http://localhost:3005'],
  ['origin', 'http://localhost:4207'],
  ['csrfToken', ''],
  ['providerId', 'local'],
  ['callbackUrl', 'http://localhost:4207'],
  ['deployment', 'deployment-name'],
  ['modelName', 'model-name'],
  ['id', 'resource-id'],
  ['bucket', 'bucket-name'],
  ['path', 'path/to/file'],
].map(([key, value]) => ({ key, value, type: 'string' }));

const collection = {
  info: {
    name: `${openApi.info?.title ?? 'Chat API'} (${openApi.info?.version ?? '1.0.0'})`,
    description: [
      openApi.info?.description,
      '',
      `Generated from libs/chat-api-client/openapi.json. Contains ${requestCount} requests grouped by OpenAPI tag.`,
      '',
      'Authentication uses the Postman cookie jar. Start the OIDC flow with the login request, then call “Get current user”; its response supplies the CSRF token used by authenticated write requests.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "const csrfToken = pm.response.headers.get('X-CSRF-Token');",
          'if (csrfToken) {',
          "  pm.collectionVariables.set('csrfToken', csrfToken);",
          '}',
        ],
      },
    },
  ],
  variable: variables,
  item: [...folders.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  ),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  await format(JSON.stringify(collection), { parser: 'json' }),
);

console.log(`Generated ${requestCount} requests at ${outputPath}`);
