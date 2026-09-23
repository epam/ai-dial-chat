import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { lookup } from 'mime-types';
import { ThemeConfigResponseDto } from '../openapi/openapi-response.dto';
import {
  GetRemoteThemeDto,
  GetRemoteThemeIconDto,
} from './dto/get-remote-theme.dto';
import { ThemeService } from './theme.service';

/**
 * Proxies a theme configuration and its images from an external themes host
 * that an application declares as its own.
 *
 * Deliberately separate from `ThemeController`, which serves the operator's
 * single configured themes host at the unversioned, `@Public()` `/api/themes`
 * routes that `ThemeProvider` calls before a session exists. These routes are
 * versioned business endpoints and require a session: fetching an
 * application-supplied URL on a caller's behalf is not a public operation.
 *
 * The origin allowlist (`THEMES_ALLOWED_ORIGINS`), not the caller's role, is
 * what bounds the outbound request — see `ThemeService.resolveAllowedOrigin`.
 */
@ApiTags('themes')
@Controller({ path: 'themes', version: '1' })
export class RemoteThemeController {
  constructor(private readonly themeService: ThemeService) {}

  /**
   * Retrieves a theme configuration from an allow-listed external themes host.
   */
  @Get('remote')
  @Header('Cache-Control', 'public, max-age=300') // 5 minutes
  @ApiOperation({
    summary: 'Get a remote theme configuration',
    description:
      'Fetches `<themeUrl>/config.json` from an external themes host, provided its origin ' +
      'is listed in THEMES_ALLOWED_ORIGINS. Redirects are not followed, the response is ' +
      'size-capped, and colour keys that are not safe as CSS custom property names are ' +
      'dropped. Results are cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the remote theme configuration',
    type: ThemeConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'themeUrl is malformed, is not https, or its origin is not allow-listed. No outbound request is made.',
    schema: {
      example: {
        statusCode: 400,
        message: 'themeUrl origin is not allowed',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No authenticated session' })
  @ApiResponse({
    status: 404,
    description: 'The host serves no configuration at that location',
  })
  @ApiResponse({
    status: 502,
    description:
      'The host redirected, returned an error, or returned an oversized or malformed body',
  })
  @ApiResponse({
    status: 503,
    description: 'The host is unreachable or the request timed out',
  })
  getRemoteTheme(@Query() query: GetRemoteThemeDto) {
    return this.themeService.getRemoteTheme(query.themeUrl);
  }

  /**
   * Retrieves one image from an allow-listed external themes host.
   */
  @Get('remote/icon')
  @Header('Cache-Control', 'public, max-age=300') // 5 minutes
  @ApiOperation({
    summary: 'Get a remote theme icon',
    description:
      'Fetches a single image from an allow-listed external themes host. The icon name is ' +
      'validated against the same allowlist as the built-in icon endpoint, so path traversal ' +
      'is rejected before any request is made. Results are cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the icon',
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
      'themeUrl is not allow-listed, or iconName failed validation (including a path traversal attempt)',
  })
  @ApiResponse({ status: 401, description: 'No authenticated session' })
  @ApiResponse({ status: 404, description: 'Icon not found on the host' })
  @ApiResponse({
    status: 502,
    description:
      'The host redirected, returned an error, or returned an oversized body',
  })
  @ApiResponse({
    status: 503,
    description: 'The host is unreachable or the request timed out',
  })
  async getRemoteThemeIcon(
    @Query() query: GetRemoteThemeIconDto,
    @Res() res: Response,
  ) {
    const file = await this.themeService.getRemoteThemeIcon(
      query.themeUrl,
      query.iconName,
    );

    res.setHeader(
      'Content-Type',
      lookup(query.iconName) || 'image/svg+xml; charset=utf-8',
    );

    return res.send(file);
  }
}
