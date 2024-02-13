import { ApiKeys } from '../server/api';
import { BucketService } from './data/bucket-service';
import { constructPath } from './file';
import { splitEntityId } from './folders';

export const getRootId = ({
  id,
  apiKey = ApiKeys.Files,
  bucket,
}: {
  id?: string;
  apiKey?: ApiKeys;
  bucket?: string;
} = {}) => {
  const splittedEntityId = id ? splitEntityId(id) : undefined;

  return constructPath(
    apiKey || splittedEntityId?.apiKey || ApiKeys.Files,
    bucket || splittedEntityId?.bucket || BucketService.getBucket(),
  );
};

export const isRootId = (id?: string) => {
  return id?.split('/').length === 2 || false;
};
