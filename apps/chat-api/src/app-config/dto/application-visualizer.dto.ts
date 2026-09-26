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

export class ApplicationVisualizerDto {
  @ApiProperty({
    description:
      'The postMessage protocol namespace, NOT a display label. Every message exchanged with the iframe is prefixed "${title}/…", and the visualizer application must be constructed with this identical string as its appName. A mismatch is a silent failure — the iframe loads but never receives data. Also used as the inline frame\'s header text.',
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
      'MIME type(s) this entry claims, as a comma-separated list (e.g. "application/vnd.plotly.v1+json, application/vnd.vega.v5+json"). Optional, unlike the required field of the same name on CustomVisualizerDto: when omitted, the entry claims every attachment of the message that carries a URL. Attachments it does not claim render as ordinary attachment tiles.',
    required: false,
    example: 'application/vnd.plotly.v1+json',
  })
  @IsOptional()
  @IsString()
  contentType?: string;

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
    description: 'Suggested initial width of the visualizer surface in pixels.',
    required: false,
    example: 800,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiProperty({
    description:
      'Suggested initial height of the visualizer surface in pixels. Also used by the host to size the inline frame in the message.',
    required: false,
    example: 600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiProperty({
    description:
      'Suggested height on mobile-sized screens in pixels. Also used by the host to size the inline frame on a mobile viewport.',
    required: false,
    example: 400,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  mobileHeight?: number;

  @ApiProperty({
    description:
      'Whether the host should pass auth info to the visualizer. Accepted for schema parity; inert, because 1.0 auth is server-side and the browser holds no access token.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  passAuthInfo?: boolean;

  @ApiProperty({
    description:
      'Whether the host should pass an explicit access token. Accepted for schema parity; inert, because 1.0 auth is server-side and the browser holds no access token.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  passExplicitToken?: boolean;

  @ApiProperty({
    description:
      'When true, the inline frame renders without its border, rounded corners, background, and header divider. Carried over from legacy Chat 0.x.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  borderless?: boolean;

  @ApiProperty({
    description:
      'When true, the inline frame hides its header title text; the header actions stay visible. Carried over from legacy Chat 0.x.',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  withoutTitle?: boolean;
}
