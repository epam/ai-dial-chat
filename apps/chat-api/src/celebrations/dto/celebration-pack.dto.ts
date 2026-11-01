import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CelebrationMediaType,
  CelebrationSceneDirection,
  CelebrationStageAlign,
  CelebrationStageFit,
  CelebrationVariantColorScheme,
  CelebrationVariantDirection,
  CelebrationVariantLayout,
} from '../types/celebration';

/** One verified asset of a pack. Its bytes are served by `getCelebrationAsset`. */
export class CelebrationAssetDto {
  @ApiProperty({
    description:
      'Asset ID, unique across the catalog; ends with the first 16 hex characters of its SHA-256.',
    example: 'new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957',
  })
  assetId!: string;

  @ApiProperty({
    description: 'Media type the asset is served with.',
    enum: CelebrationMediaType,
    enumName: 'CelebrationMediaType',
  })
  mediaType!: CelebrationMediaType;

  @ApiProperty({
    description: 'Exact byte length of the uncompressed asset.',
    example: 5210,
  })
  bytes!: number;

  @ApiProperty({
    description: 'Lowercase hex SHA-256 of the uncompressed asset.',
    example: '8e2d4a6c0f1b39570000000000000000000000000000000000000000000000ab',
  })
  sha256!: string;
}

/** Where a scene is placed. Only `viewport-stage-v1` carries further fields. */
export class CelebrationPlacementDto {
  @ApiProperty({
    description:
      'Placement template ID. Templates other than viewport-stage-v1 are passed as the ID alone, and clients without the matching capability skip the scene.',
    example: 'viewport-stage-v1',
  })
  template!: string;

  @ApiPropertyOptional({
    description: 'How the stage scales into the viewport (viewport-stage-v1).',
    enum: CelebrationStageFit,
    enumName: 'CelebrationStageFit',
  })
  fit?: CelebrationStageFit;

  @ApiPropertyOptional({
    description:
      'Where the stage sits in the viewport, in logical terms (viewport-stage-v1).',
    enum: CelebrationStageAlign,
    enumName: 'CelebrationStageAlign',
  })
  align?: CelebrationStageAlign;
}

/** Scene timing in milliseconds. */
export class CelebrationTimingDto {
  @ApiProperty({ description: 'Authored story length.', example: 12000 })
  playbackDurationMs!: number;

  @ApiProperty({
    description:
      'Time allowed for the player and animation data, at most 2000.',
    example: 2000,
  })
  loadTimeoutMs!: number;

  @ApiProperty({
    description: 'Time from loadAnimation to renderer readiness, at most 250.',
    example: 250,
  })
  readyTimeoutMs!: number;

  @ApiProperty({
    description:
      'Total lifetime from mount, at least load + ready + playback and at most 32000.',
    example: 15000,
  })
  maxLifetimeMs!: number;
}

/** Host conditions a variant requires; an absent field matches any value. */
export class CelebrationVariantConditionsDto {
  @ApiPropertyOptional({
    enum: CelebrationVariantLayout,
    enumName: 'CelebrationVariantLayout',
    description: 'Required host layout.',
  })
  layout?: CelebrationVariantLayout;

  @ApiPropertyOptional({
    enum: CelebrationVariantDirection,
    enumName: 'CelebrationVariantDirection',
    description: 'Required text direction.',
  })
  direction?: CelebrationVariantDirection;

  @ApiPropertyOptional({
    enum: CelebrationVariantColorScheme,
    enumName: 'CelebrationVariantColorScheme',
    description: 'Required color scheme.',
  })
  colorScheme?: CelebrationVariantColorScheme;
}

/** One animation of a scene and the conditions it needs. */
export class CelebrationVariantDto {
  @ApiProperty({
    description: 'Conditions the variant requires.',
    type: CelebrationVariantConditionsDto,
  })
  when!: CelebrationVariantConditionsDto;

  @ApiProperty({
    description: 'Asset ID of the Lottie JSON.',
    example: 'new-year-default-snowman-delivery-desktop-5b0c7e19a2d4f836',
  })
  animationAssetId!: string;
}

/** One scene of a pack. */
export class CelebrationSceneDto {
  @ApiProperty({
    description:
      'Scene ID; a scene that replaces a bundled scene uses its bundled ID.',
    example: 'snowman-delivery',
  })
  id!: string;

  @ApiProperty({
    description: 'Label ID of the notification text shown with the scene.',
    example: 'snowmanDeliveryToastMessage',
  })
  labelId!: string;

  @ApiProperty({
    description: 'Renderer capability ID.',
    example: 'lottie-light-svg-v1',
  })
  renderer!: string;

  @ApiProperty({
    description: 'Capabilities the client must support to play the scene.',
    type: [String],
    example: ['lottie-light-svg-v1', 'viewport-stage-v1', 'static-poster-v1'],
  })
  requiredCapabilities!: string[];

  @ApiProperty({
    description: 'Scene placement.',
    type: CelebrationPlacementDto,
  })
  placement!: CelebrationPlacementDto;

  @ApiProperty({
    description: 'How the scene adapts to a right-to-left host.',
    enum: CelebrationSceneDirection,
    enumName: 'CelebrationSceneDirection',
  })
  direction!: CelebrationSceneDirection;

  @ApiProperty({ description: 'Scene timing.', type: CelebrationTimingDto })
  timing!: CelebrationTimingDto;

  @ApiProperty({
    description: 'Asset ID of the static poster.',
    example: 'new-year-default-snowman-delivery-poster-8e2d4a6c0f1b3957',
  })
  posterAssetId!: string;

  @ApiProperty({
    description: 'How long the poster stays, from 1000 to maxLifetimeMs.',
    example: 4000,
  })
  posterDurationMs!: number;

  @ApiProperty({
    description: 'One to eight variants, in declaration order.',
    type: [CelebrationVariantDto],
  })
  variants!: CelebrationVariantDto[];
}

/** The static trigger of an external-only event. */
export class CelebrationDecorationDto {
  @ApiProperty({
    description: 'Decoration template ID.',
    example: 'static-trigger-v1',
  })
  template!: string;

  @ApiProperty({
    description: 'Asset ID of the trigger image.',
    example: 'company-anniversary-icon-fdfbf047a8df14a3',
  })
  posterAssetId!: string;

  @ApiProperty({
    description: 'Label ID of the trigger accessible name.',
    example: 'activate',
  })
  labelId!: string;
}

/** Event-level fields that only an external-only event declares. */
export class CelebrationEventDto {
  @ApiProperty({
    description: 'Label ID of the notification title.',
    example: 'toastTitle',
  })
  titleLabelId!: string;

  @ApiProperty({
    description: 'Scenes the trigger plays, each a declared scene ID.',
    type: [String],
    example: ['confetti'],
  })
  clickSceneIds!: string[];

  @ApiPropertyOptional({
    description: 'Asset ID of the event icon.',
    example: 'company-anniversary-icon-fdfbf047a8df14a3',
  })
  iconAssetId?: string;

  @ApiProperty({
    description: 'The static trigger.',
    type: CelebrationDecorationDto,
  })
  decoration!: CelebrationDecorationDto;
}

/** A validated celebration pack version. Contains no upstream paths. */
export class CelebrationPackDto {
  @ApiProperty({ description: 'Pack ID.', example: 'new-year-default' })
  packId!: string;

  @ApiProperty({ description: 'Pack version.', example: '1.0.0' })
  version!: string;

  @ApiProperty({ description: 'Celebration event ID.', example: 'new-year' })
  eventId!: string;

  @ApiProperty({
    description:
      'Revision of the celebration index the pack was resolved from.',
    example: '2026-11-15.1',
  })
  catalogRevision!: string;

  @ApiProperty({
    description: 'Capabilities the pack as a whole requires.',
    type: [String],
    example: ['lottie-light-svg-v1', 'viewport-stage-v1', 'static-poster-v1'],
  })
  requiredCapabilities!: string[];

  @ApiProperty({
    description: 'Every asset the pack declares.',
    type: [CelebrationAssetDto],
  })
  assets!: CelebrationAssetDto[];

  @ApiProperty({
    description:
      'Pack labels as locale → label ID → plain text. Includes en whenever it is non-empty.',
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    example: { en: { toastTitle: 'Happy anniversary!' } },
  })
  labels!: Record<string, Record<string, string>>;

  @ApiPropertyOptional({
    description: 'Event-level fields; present only for an external-only event.',
    type: CelebrationEventDto,
  })
  event?: CelebrationEventDto;

  @ApiProperty({
    description: 'Scenes in declaration order.',
    type: [CelebrationSceneDto],
  })
  scenes!: CelebrationSceneDto[];
}
