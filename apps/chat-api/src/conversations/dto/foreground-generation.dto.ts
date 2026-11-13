import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

/**
 * Server-owned marker on the assistant message a Chat Completions or stateless Responses
 * generation is producing. While it is live (before `expiresAt`), it holds the conversation:
 * every other generation is refused, and client saves cannot change or drop the message.
 */
export class ForegroundGenerationDto {
  @ApiProperty({
    description:
      'Client-supplied generation id of the request that started the generation; identifies this message across writes.',
    example: '4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f',
  })
  @IsUUID('4')
  generationId!: string;

  @ApiProperty({
    description:
      'Server time (epoch ms) at which the start-state write was built.',
    example: 1793875200000,
  })
  @IsInt()
  startedAt!: number;

  @ApiProperty({
    description:
      'Server time (epoch ms) after which the marker no longer holds the conversation.',
    example: 1793877120000,
  })
  @IsInt()
  expiresAt!: number;

  @ApiPropertyOptional({
    description:
      'Server time (epoch ms) at which a Stop was stored on the marker; the generation stops at its next re-read.',
    example: 1793875260000,
  })
  @IsOptional()
  @IsInt()
  stopRequestedAt?: number;
}
