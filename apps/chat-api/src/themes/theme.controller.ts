import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { lookup } from 'mime-types';
import { Public } from '../common/decorators/public.decorator';
import { ThemeConfigResponseDto } from '../openapi/openapi-response.dto';
import { GetThemeIconDto } from './dto/get-theme-icon.dto';
import { ThemeService } from './theme.service';
/**
 * Controller for theme-related endpoints.
 *
 * Provides access to theme configuration and icon resources from an external themes service.
 * Rate limiting: 100 requests per minute (global), with custom limits per endpoint.
 */
@Public()
@ApiTags('themes')
@Controller('themes')
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  /**
   * Retrieves the complete theme configuration.
   *
   * @returns The theme configuration object containing available themes and their properties
   *
   * @throws {NotFoundException} When the theme configuration is not found
   * @throws {BadGatewayException} When the external service returns an error
   * @throws {ServiceUnavailableException} When the external service is unavailable or times out
   */
  @Get()
  @Header('Cache-Control', 'public, max-age=300') // 5 minutes
  @ApiOperation({
    summary: 'Get themes configuration',
    description:
      'Fetches the complete theme configuration from the external themes service. ' +
      'Returns a JSON object containing all available themes with their properties, colors, and icon references. ' +
      'Results are cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved theme configuration',
    type: ThemeConfigResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Theme configuration not found on the external service',
  })
  @ApiResponse({
    status: 502,
    description: 'External theme service returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'Theme service is unavailable or request timed out',
  })
  getThemes() {
    return this.themeService.getThemes();
  }

  /**
   * Retrieves a theme icon as SVG content.
   *
   * @param query - Query parameters containing the icon name
   * @returns SVG content as a string with appropriate Content-Type header
   *
   * @throws {BadRequestException} When the icon name contains invalid characters (path traversal attempt)
   * @throws {NotFoundException} When the requested icon is not found
   * @throws {BadGatewayException} When the external service returns an error
   * @throws {ServiceUnavailableException} When the external service is unavailable or times out
   *
   * @remarks
   * Icon names are validated to allow only alphanumeric characters, dashes, underscores, and dots.
   * This prevents path traversal attacks.
   */
  @Get('icon')
  @Header('Cache-Control', 'public, max-age=300') // 5 minutes
  @ApiOperation({
    summary: 'Get theme icon',
    description:
      'Fetches a theme icon as SVG or PNG content from the external themes service. ' +
      'The icon name is validated to prevent path traversal attacks - only alphanumeric characters, ' +
      'dashes, underscores, and dots are allowed. Results are cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved icon content',
    content: {
      'image/svg+xml': {
        schema: { type: 'string' },
        example:
          '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid icon name (validation failed or path traversal attempt)',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'Icon name must contain only alphanumeric characters, dash, underscore, and dot',
        ],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Icon not found on the external service',
  })
  @ApiResponse({
    status: 502,
    description: 'External theme service returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'Theme service is unavailable or request timed out',
  })
  async getThemeIcon(@Query() query: GetThemeIconDto, @Res() res: Response) {
    const file = await this.themeService.getThemeIcon(query.iconName || '');

    const mimeType =
      lookup(query.iconName || '') || 'image/svg+xml; charset=utf-8';

    res.setHeader('Content-Type', mimeType);

    return res.send(file);
  }
}
