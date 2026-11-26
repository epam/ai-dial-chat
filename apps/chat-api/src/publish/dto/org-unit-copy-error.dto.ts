import { UnprocessableEntityException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/** Domain code on a `422` that refuses a direct write into an org-unit folder. */
export enum OrgUnitCopyErrorCode {
  /** The application refers to a folder of files, which DIAL Core copies only for a DIAL admin; a publication request carries it instead. */
  FolderReferenceNeedsRequest = 'folderReferenceNeedsRequest',
}

/** Message of the refusal of a folder-reference application. */
export const FOLDER_REFERENCE_NEEDS_REQUEST_MESSAGE =
  'This application refers to a folder of files, so it cannot be saved directly to the folder. Publish it through a publication request instead';

/** The `422` for an application with a folder reference written by a caller who is not a DIAL admin. */
export const createFolderReferenceNeedsRequest =
  (): UnprocessableEntityException =>
    new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      code: OrgUnitCopyErrorCode.FolderReferenceNeedsRequest,
      message: FOLDER_REFERENCE_NEEDS_REQUEST_MESSAGE,
    });

/** Error body of a direct write into an org-unit folder that was refused with `422`. */
export class OrgUnitCopyErrorDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({ example: 'Unprocessable Entity' })
  error!: string;

  @ApiProperty({ example: FOLDER_REFERENCE_NEEDS_REQUEST_MESSAGE })
  message!: string;

  @ApiProperty({
    enum: OrgUnitCopyErrorCode,
    enumName: 'OrgUnitCopyErrorCode',
    description:
      '`folderReferenceNeedsRequest`: the application, or an application dependency to be copied, refers to a folder of files and the caller is not a DIAL admin, so it has to go through a publication request.',
  })
  code!: OrgUnitCopyErrorCode;
}
