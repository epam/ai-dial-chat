import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConversationDeletionFailureDto {
  @ApiProperty({ description: 'Conversation ID that failed to delete' })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Stable application error code',
    enum: ['NOT_FOUND', 'FORBIDDEN', 'UPSTREAM_ERROR', 'UNKNOWN'],
  })
  @IsString()
  @IsIn(['NOT_FOUND', 'FORBIDDEN', 'UPSTREAM_ERROR', 'UNKNOWN'])
  code!: string;
}

export class ConversationDeletionResultDto {
  @ApiProperty({
    description:
      'Total number of IDs received in the request (after deduplication)',
  })
  @IsInt()
  @Min(0)
  requested!: number;

  @ApiProperty({
    description: 'Number of conversations successfully deleted from DIAL Core',
  })
  @IsInt()
  @Min(0)
  deleted!: number;

  @ApiProperty({
    description:
      'Number of IDs that were already absent from DIAL Core (counted as success)',
  })
  @IsInt()
  @Min(0)
  alreadyAbsent!: number;

  @ApiProperty({
    description: 'Items that could not be deleted',
    type: [ConversationDeletionFailureDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationDeletionFailureDto)
  failed!: ConversationDeletionFailureDto[];
}
