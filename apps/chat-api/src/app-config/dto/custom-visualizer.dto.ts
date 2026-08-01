import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CustomVisualizerDto {
  @ApiProperty({
    description:
      'The postMessage protocol namespace, NOT a display label. Every message exchanged with the iframe is prefixed "${title}/…", and the visualizer application must be constructed with this identical string as its appName. A mismatch is a silent failure — the iframe loads but never receives data.',
    example: 'my-viz',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description:
      'Human-readable description of the visualizer. Accepted for schema parity; not consumed by the host UI.',
    required: false,
    example: 'Renders a Plotly figure',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'Icon URL or identifier for the visualizer. Accepted for schema parity; not consumed by the host UI.',
    required: false,
    example: 'https://viz.example.com/icon.svg',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    description:
      'MIME type(s) this entry matches. Accepts a comma-separated list of MIME types (e.g. "application/vnd.plotly.v1+json, application/vnd.vega.v5+json").',
    example: 'application/vnd.plotly.v1+json',
  })
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiProperty({
    description: 'Absolute HTTP(S) URL of the visualizer iframe.',
    example: 'https://viz.example.com',
  })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;

  @ApiProperty({
    description:
      'Milliseconds to wait for a send() request response before rejecting. Defaults to 10000 when unset. Does not bound the initial READY_TO_INTERACT handshake.',
    required: false,
    example: 15000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  requestTimeout?: number;

  @ApiProperty({
    description: 'Suggested initial width of the canvas panel in pixels.',
    required: false,
    example: 800,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiProperty({
    description: 'Suggested initial height of the canvas panel in pixels.',
    required: false,
    example: 600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiProperty({
    description:
      'Suggested canvas panel height on mobile-sized screens in pixels.',
    required: false,
    example: 400,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  mobileHeight?: number;

  @ApiProperty({
    description:
      'Whether the host should pass auth info to the visualizer. Accepted for schema parity; auth forwarding is not yet wired.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  passAuthInfo?: boolean;

  @ApiProperty({
    description:
      'Whether the host should pass an explicit access token. Accepted for schema parity; auth forwarding is not yet wired.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  passExplicitToken?: boolean;
}
