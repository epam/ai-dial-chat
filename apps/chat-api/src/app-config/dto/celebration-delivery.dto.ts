import { ApiProperty } from '@nestjs/swagger';
import { CelebrationDeliveryMode } from '../types/celebration-delivery';

/** One scene of a compiled event that may come from an external pack. */
export class CelebrationExternalSceneDto {
  @ApiProperty({ description: 'Celebration event ID.', example: 'new-year' })
  eventId!: string;

  @ApiProperty({
    description: 'Scene ID within the event.',
    example: 'snowman-delivery',
  })
  sceneId!: string;
}

/** Operator policy for external celebration packs. */
export class CelebrationDeliveryDto {
  @ApiProperty({
    description:
      'Where scenes come from. Sourced from UI_EVENT_DELIVERY_MODE; bundled unless it is prefer-external.',
    enum: CelebrationDeliveryMode,
    enumName: 'CelebrationDeliveryMode',
    example: CelebrationDeliveryMode.Bundled,
  })
  mode!: CelebrationDeliveryMode;

  @ApiProperty({
    description:
      'Operator revision of this policy, from UI_EVENT_DELIVERY_REVISION; changing it restarts a playing scene. Defaults to "0".',
    example: '0',
  })
  revision!: string;

  @ApiProperty({
    description:
      'Scenes of compiled events that may come from a pack, from UI_EVENT_EXTERNAL_SCENES. Empty by default.',
    type: [CelebrationExternalSceneDto],
  })
  externalScenes!: CelebrationExternalSceneDto[];

  @ApiProperty({
    description:
      'Event IDs without a compiled module that may come entirely from a pack, from UI_EVENT_EXTERNAL_EVENTS. Empty by default.',
    type: [String],
    example: [],
  })
  externalEvents!: string[];
}
