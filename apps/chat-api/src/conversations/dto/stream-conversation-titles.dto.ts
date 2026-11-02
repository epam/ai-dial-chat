import { ApiProperty, getSchemaPath, type SchemaObject } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import {
  CONVERSATION_RESOURCE_ID_MAX_LENGTH,
  CONVERSATION_RESOURCE_ID_PATTERN,
  parseConversationResourceId,
} from '../utils/conversation-resource-id';

/** Upper bound on IDs accepted by one title stream request. */
export const CONVERSATION_TITLE_STREAM_MAX_IDS = 500;
/** Upper bound on the UTF-8 size of `JSON.stringify(ids)`; larger is HTTP 413. */
export const CONVERSATION_TITLE_STREAM_MAX_ID_BYTES = 256 * 1024;

export enum ConversationTitleStreamEventType {
  Title = 'title',
  Unavailable = 'unavailable',
  ItemError = 'item_error',
  Done = 'done',
  Error = 'error',
}

export enum ConversationTitleStreamItemErrorCode {
  UpstreamError = 'upstream_error',
  Timeout = 'timeout',
}

export enum ConversationTitleStreamDoneReason {
  /** Every distinct requested ID received an item outcome. */
  Complete = 'complete',
  /** The request budget ended; IDs without an outcome were never attempted. */
  Budget = 'budget',
}

export enum ConversationTitleStreamErrorCode {
  Unauthenticated = 'unauthenticated',
  UpstreamError = 'upstream_error',
  Unavailable = 'unavailable',
}

export class StreamConversationTitlesBodyDto {
  @ApiProperty({
    description: `Full DIAL Core conversation resource URLs, at most ${CONVERSATION_TITLE_STREAM_MAX_IDS} and ${CONVERSATION_TITLE_STREAM_MAX_ID_BYTES} bytes as a serialized JSON array. Duplicate IDs produce one outcome; visible conversations should come first, because IDs are admitted in order.`,
    type: [String],
    minItems: 1,
    maxItems: CONVERSATION_TITLE_STREAM_MAX_IDS,
    example: [
      'conversations/default-bucket/gpt-4o__First',
      'conversations/default-bucket/gpt-4o__Second',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONVERSATION_TITLE_STREAM_MAX_IDS)
  @IsString({ each: true })
  @MaxLength(CONVERSATION_RESOURCE_ID_MAX_LENGTH, { each: true })
  @Matches(CONVERSATION_RESOURCE_ID_PATTERN, { each: true })
  @ValidateBy(
    {
      name: 'conversationResourceId',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          parseConversationResourceId(value) != null,
        defaultMessage: () =>
          'Each id must be a full conversation resource URL without traversal or control characters',
      },
    },
    { each: true },
  )
  ids!: string[];
}

const ID_EXAMPLE = 'conversations/default-bucket/gpt-4o__First';
const ID_DESCRIPTION =
  'The exact conversation resource URL supplied in the request.';

export class ConversationTitleStreamTitleEventDto {
  @ApiProperty({ enum: [ConversationTitleStreamEventType.Title] })
  type!: ConversationTitleStreamEventType.Title;

  @ApiProperty({ description: ID_DESCRIPTION, example: ID_EXAMPLE })
  id!: string;

  @ApiProperty({
    description: 'Current display title without conversation messages.',
    example: 'First renamed title',
  })
  title!: string;
}

export class ConversationTitleStreamUnavailableEventDto {
  @ApiProperty({ enum: [ConversationTitleStreamEventType.Unavailable] })
  type!: ConversationTitleStreamEventType.Unavailable;

  @ApiProperty({
    description: `${ID_DESCRIPTION} The conversation is missing or inaccessible; which one is not disclosed.`,
    example: ID_EXAMPLE,
  })
  id!: string;
}

export class ConversationTitleStreamItemErrorEventDto {
  @ApiProperty({ enum: [ConversationTitleStreamEventType.ItemError] })
  type!: ConversationTitleStreamEventType.ItemError;

  @ApiProperty({ description: ID_DESCRIPTION, example: ID_EXAMPLE })
  id!: string;

  @ApiProperty({
    enum: ConversationTitleStreamItemErrorCode,
    enumName: 'ConversationTitleStreamItemErrorCode',
    description:
      'Why this attempted item failed. It is not retried by the stream.',
  })
  code!: ConversationTitleStreamItemErrorCode;
}

export class ConversationTitleStreamDoneEventDto {
  @ApiProperty({ enum: [ConversationTitleStreamEventType.Done] })
  type!: ConversationTitleStreamEventType.Done;

  @ApiProperty({
    enum: ConversationTitleStreamDoneReason,
    enumName: 'ConversationTitleStreamDoneReason',
    description:
      '`complete` when every distinct ID has an outcome; `budget` when the request lifetime ended and IDs without an outcome may be requested again.',
  })
  reason!: ConversationTitleStreamDoneReason;

  @ApiProperty({
    description:
      'Item outcome events emitted (title, unavailable, item_error).',
    example: 2,
  })
  processed!: number;

  @ApiProperty({ description: 'Distinct requested IDs.', example: 2 })
  total!: number;
}

export class ConversationTitleStreamErrorEventDto {
  @ApiProperty({ enum: [ConversationTitleStreamEventType.Error] })
  type!: ConversationTitleStreamEventType.Error;

  @ApiProperty({
    enum: [401, 502, 503],
    description:
      'HTTP-equivalent status of the stream-fatal failure; the response status was already 200.',
    example: 503,
  })
  status!: 401 | 502 | 503;

  @ApiProperty({
    enum: ConversationTitleStreamErrorCode,
    enumName: 'ConversationTitleStreamErrorCode',
    description:
      'Paired with `status`: 401/unauthenticated, 502/upstream_error, 503/unavailable.',
  })
  code!: ConversationTitleStreamErrorCode;
}

export type ConversationTitleStreamEventDto =
  | ConversationTitleStreamTitleEventDto
  | ConversationTitleStreamUnavailableEventDto
  | ConversationTitleStreamItemErrorEventDto
  | ConversationTitleStreamDoneEventDto
  | ConversationTitleStreamErrorEventDto;

export const CONVERSATION_TITLE_STREAM_EVENT_MODELS = [
  ConversationTitleStreamTitleEventDto,
  ConversationTitleStreamUnavailableEventDto,
  ConversationTitleStreamItemErrorEventDto,
  ConversationTitleStreamDoneEventDto,
  ConversationTitleStreamErrorEventDto,
];

/**
 * Named `oneOf` component for {@link ConversationTitleStreamEventDto}, so the
 * generated client exposes the event union the app adapter validates.
 * Swagger decorators cannot declare a union class, so the OpenAPI document
 * builder registers this schema.
 */
export const CONVERSATION_TITLE_STREAM_EVENT_SCHEMA: SchemaObject = {
  description:
    'One `data:` JSON payload of the conversation title stream, discriminated by `type`.',
  oneOf: CONVERSATION_TITLE_STREAM_EVENT_MODELS.map((model) => ({
    $ref: getSchemaPath(model),
  })),
  discriminator: {
    propertyName: 'type',
    mapping: {
      [ConversationTitleStreamEventType.Title]: getSchemaPath(
        ConversationTitleStreamTitleEventDto,
      ),
      [ConversationTitleStreamEventType.Unavailable]: getSchemaPath(
        ConversationTitleStreamUnavailableEventDto,
      ),
      [ConversationTitleStreamEventType.ItemError]: getSchemaPath(
        ConversationTitleStreamItemErrorEventDto,
      ),
      [ConversationTitleStreamEventType.Done]: getSchemaPath(
        ConversationTitleStreamDoneEventDto,
      ),
      [ConversationTitleStreamEventType.Error]: getSchemaPath(
        ConversationTitleStreamErrorEventDto,
      ),
    },
  },
};

export const CONVERSATION_TITLE_STREAM_EXAMPLE = [
  ': init',
  '',
  'data: {"type":"title","id":"conversations/default-bucket/gpt-4o__Second","title":"Second renamed title"}',
  '',
  'data: {"type":"title","id":"conversations/default-bucket/gpt-4o__First","title":"First renamed title"}',
  '',
  'data: {"type":"done","reason":"complete","processed":2,"total":2}',
  '',
  '',
].join('\n');

export const CONVERSATION_TITLE_STREAM_ERROR_EXAMPLE = [
  ': init',
  '',
  'data: {"type":"unavailable","id":"conversations/default-bucket/gpt-4o__First"}',
  '',
  'data: {"type":"error","status":503,"code":"unavailable"}',
  '',
  '',
].join('\n');
