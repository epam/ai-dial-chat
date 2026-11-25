import { NotFoundException } from '@nestjs/common';
import { PUBLIC_BUCKET } from '../constants/dial.constants';
import {
  buildDialFileResourceUrl,
  toPlainDialPath,
} from '../files/dial-resource-path.util';
import type { FilesListingService } from '../files/listing/files-listing.service';

/** A `resources` entry for a publication request. */
export interface PublicationFileResource {
  action: 'ADD' | 'DELETE';
  sourceUrl?: string;
  targetUrl: string;
}

/**
 * The `DELETE` resources for the files that exist in a published folder: Core
 * fails a `DELETE` of a target that is gone, so the live listing is the only
 * safe list. A folder that does not exist yields no resources.
 * @param filesListingService - lists the public bucket
 * @param accessToken - caller's bearer token
 * @param folderUrl - `files/public/{folder}/{name}/`, percent-encoded, trailing-slashed
 */
export const buildPublishedFolderDeleteResources = async (
  filesListingService: FilesListingService,
  accessToken: string,
  folderUrl: string,
): Promise<PublicationFileResource[]> => {
  let expanded;
  try {
    expanded = await filesListingService.expandFolderContents(
      PUBLIC_BUCKET,
      toPlainDialPath(folderUrl),
      '',
      accessToken,
    );
  } catch (err) {
    if (err instanceof NotFoundException) return [];
    throw err;
  }

  return expanded.map((file) => ({
    action: 'DELETE' as const,
    targetUrl: buildDialFileResourceUrl(PUBLIC_BUCKET, file.path),
  }));
};
