import {
  ConflictException,
  ForbiddenException,
  type Logger,
} from '@nestjs/common';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  handleDialSdkError,
  mapDialHttpStatus,
} from '../dial/dial-error.mapper';
import type { ResourceFolderDto } from '../dto/resource-folder.dto';
import { encodePlainDialResourcePath } from './encode-dial-path';

/**
 * DIAL Core resource types whose personal items can be listed by folder and
 * moved or copied. `Projects` is only read: its metadata answers
 * {@link dialResourceExists}; no project is moved or copied through here.
 * `Files` can be copied and checked for existence, not listed here.
 */
export enum DialResourceType {
  Applications = 'applications',
  Toolsets = 'toolsets',
  Prompts = 'prompts',
  Skills = 'skills',
  Projects = 'projects',
  Files = 'files',
}

/** A resource inside one bucket; `path` is percent-encoded per segment. */
export interface DialResourceLocation {
  bucket: string;
  path: string;
}

type DialSdkClient = DialClientService['client'];

type AuthHeaders = Record<string, string>;

interface MetadataListPage {
  data?: {
    items?: { name?: string; nodeType?: string }[];
    nextToken?: string;
  };
  error?: unknown;
  response?: globalThis.Response;
}

const getMetadata = (
  client: DialSdkClient,
  type: DialResourceType,
  bucket: string,
  path: string,
  headers: AuthHeaders,
  token?: string,
): Promise<MetadataListPage> => {
  const init = { headers, params: { query: { token } } };
  if (type === DialResourceType.Applications) {
    return client.getApplicationMetadata(
      bucket,
      path,
      init,
    ) as Promise<MetadataListPage>;
  }
  if (type === DialResourceType.Files) {
    return client.getFileMetadata(bucket, path, {
      headers,
    }) as Promise<MetadataListPage>;
  }
  if (type === DialResourceType.Skills) {
    return client.listSkillMetadata(
      bucket,
      path,
      init,
    ) as Promise<MetadataListPage>;
  }
  if (type === DialResourceType.Prompts) {
    return client.getPromptMetadata(
      bucket,
      path,
      init,
    ) as Promise<MetadataListPage>;
  }
  if (type === DialResourceType.Projects) {
    return client.listProjectMetadata(
      bucket,
      path,
      init,
    ) as Promise<MetadataListPage>;
  }
  return client.getToolSetMetadata(
    bucket,
    path,
    init,
  ) as Promise<MetadataListPage>;
};

/** `{type}/{bucket}/{path}`, the url form DIAL Core's move/copy operations take. */
export const toDialResourceUrl = (
  type: DialResourceType,
  location: DialResourceLocation,
): string => `${type}/${location.bucket}/${location.path}`;

/** The last, still-encoded segment of a resource path: the item's own name. */
export const getResourceLeaf = (encodedPath: string): string =>
  encodedPath.split('/').pop() ?? encodedPath;

/**
 * The encoded storage path of `encodedLeaf` inside `folderPath`. `folderPath`
 * is plain text off a request body (empty = bucket root), so it is encoded
 * without the lossy pre-decode `encodeDialResourcePath` applies.
 */
export const buildFolderResourcePath = (
  folderPath: string,
  encodedLeaf: string,
): string =>
  folderPath
    ? `${encodePlainDialResourcePath(folderPath)}/${encodedLeaf}`
    : encodedLeaf;

/**
 * Rejects a resource outside the caller's own bucket. Moving, forking or
 * swapping another user's resource is never a personal-folder operation,
 * even where DIAL Core would grant write access through a share.
 */
export const assertOwnBucket = (
  location: DialResourceLocation,
  sessionBucket: string,
): void => {
  if (location.bucket !== sessionBucket) {
    throw new ForbiddenException(
      'Only resources in your own bucket can be moved or versioned',
    );
  }
};

/**
 * Lists the folders directly under `folderPath` (plain text, empty = root)
 * of `type` in `bucket`, following every metadata page. A folder that does
 * not exist yet lists as empty, matching how DIAL Core creates folders
 * implicitly on the first write beneath them.
 */
export const listDialResourceFolders = async (
  client: DialSdkClient,
  type: DialResourceType,
  headers: AuthHeaders,
  bucket: string,
  folderPath: string,
  logger: Logger,
): Promise<ResourceFolderDto[]> => {
  const context = `${type}.listFolders`;
  const metadataPath = folderPath
    ? `${encodePlainDialResourcePath(folderPath)}/`
    : '';
  const folders: ResourceFolderDto[] = [];
  const visitedTokens = new Set<string>();
  let pageToken: string | undefined;

  try {
    do {
      const { data, error, response } = await getMetadata(
        client,
        type,
        bucket,
        metadataPath,
        headers,
        pageToken,
      );
      if (response?.status === 404) return [];
      if (error != null || data == null) {
        return handleDialSdkError(error, context, logger, response);
      }
      for (const item of data.items ?? []) {
        if (item.nodeType !== 'FOLDER' || !item.name) continue;
        // DIAL Core returns `name` already decoded.
        folders.push({
          name: item.name,
          path: folderPath ? `${folderPath}/${item.name}` : item.name,
        });
      }
      pageToken = data.nextToken;
      if (pageToken != null) {
        if (visitedTokens.has(pageToken)) {
          return handleDialSdkError(
            new Error('DIAL Core returned a repeated metadata page token'),
            context,
            logger,
          );
        }
        visitedTokens.add(pageToken);
      }
    } while (pageToken != null);
  } catch (err) {
    return handleDialSdkError(err, context, logger);
  }

  return folders;
};

/**
 * Whether `location` holds a resource of `type`, read with the caller's own
 * token: `200` is present, `404` absent. A copy the caller cannot read answers
 * `404` too, so `false` means "not found", never "does not exist".
 * @param client - DIAL Core client
 * @param type - resource type of `location`
 * @param location - bucket and percent-encoded path to read
 * @param headers - the caller's auth headers
 * @param context - names the operation in the log and the mapped error
 * @param logger - optional logger for the mapped error
 * @throws {HttpException} The mapped exception when Core answers anything but `200` or `404`
 */
export const dialResourceExists = async (
  client: DialSdkClient,
  type: DialResourceType,
  location: DialResourceLocation,
  headers: AuthHeaders,
  context: string,
  logger?: Logger,
): Promise<boolean> => {
  try {
    const { error, response } = await getMetadata(
      client,
      type,
      location.bucket,
      location.path,
      headers,
    );
    if (response?.status === 200) return true;
    if (response?.status === 404) return false;
    return handleDialSdkError(error, context, logger, response);
  } catch (err) {
    return handleDialSdkError(err, context, logger);
  }
};

/** {@link dialResourceExists} where a failed read counts as "not found". */
export const existsQuietly = async (
  client: DialSdkClient,
  type: DialResourceType,
  location: DialResourceLocation,
  headers: AuthHeaders,
): Promise<boolean> => {
  try {
    return await dialResourceExists(
      client,
      type,
      location,
      headers,
      'exists probe',
    );
  } catch {
    return false;
  }
};

/**
 * Whether a resource exists: `true` for 200 and `false` for 404.
 * Any other answer, or a failed request, throws, so a transient failure is never read as "absent".
 * @param client - DIAL Core SDK client
 * @param type - resource type of `location`
 * @param location - bucket and path of the resource
 * @param headers - bearer headers for DIAL Core
 * @throws {Error} When Core answers with anything but 200 or 404
 */
export const resourceExists = async (
  client: DialSdkClient,
  type: DialResourceType,
  location: DialResourceLocation,
  headers: AuthHeaders,
): Promise<boolean> => {
  const { response } = await getMetadata(
    client,
    type,
    location.bucket,
    location.path,
    headers,
  );
  if (response?.status === 200) return true;
  if (response?.status === 404) return false;
  throw new Error(
    `Could not tell whether ${toDialResourceUrl(type, location)} exists (status ${response?.status})`,
  );
};

/** Parameters for {@link transferDialResource}. */
export interface TransferDialResourceParams {
  client: DialSdkClient;
  operation: 'moveResource' | 'copyResource';
  type: DialResourceType;
  headers: AuthHeaders;
  source: DialResourceLocation;
  destination: DialResourceLocation;
  context: string;
  logger: Logger;
}

/**
 * Moves or copies one resource without ever overwriting the destination.
 * DIAL Core answers a non-overwriting transfer onto an existing target with
 * 400, so a 400 whose destination now exists is reported as 409.
 */
export const transferDialResource = async ({
  client,
  operation,
  type,
  headers,
  source,
  destination,
  context,
  logger,
}: TransferDialResourceParams): Promise<void> => {
  const { error, response } = await client[operation]({
    headers,
    body: {
      sourceUrl: toDialResourceUrl(type, source),
      destinationUrl: toDialResourceUrl(type, destination),
      overwrite: false,
    },
  });
  if (error == null && response.status < 400) return;

  if (
    response.status === 400 &&
    (await existsQuietly(client, type, destination, headers))
  ) {
    logger.warn(`DIAL Core rejected ${context}: target already exists`);
    throw new ConflictException('Target resource already exists');
  }
  return mapDialHttpStatus(response.status, context, logger);
};
