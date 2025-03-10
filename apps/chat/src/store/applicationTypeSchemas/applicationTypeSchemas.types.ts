import {
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-schema';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface ApplicationTypesSchemasState {
  schemasLoading: UploadStatus;
  schemas: ApplicationTypeSchema[];
  detailedApplicationTypeSchema: ApiDetailedApplicationTypeSchema | null;
  detailedApplicationTypeSchemaLoading: UploadStatus;
}
