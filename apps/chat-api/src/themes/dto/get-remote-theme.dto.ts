import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, Matches } from 'class-validator';

/*
 * `https` is required at the DTO layer so a plain-http URL never reaches the
 * service. Whether the origin is *allowed* is a separate, server-side check —
 * the allowlist is operator configuration and is deliberately not expressed
 * in the public contract.
 */
export class GetRemoteThemeDto {
  @ApiProperty({
    description:
      'Base URL of an allow-listed external themes host. The service requests ' +
      '`<themeUrl>/config.json`; any query string or fragment is ignored.',
    example: 'https://themes.contoso.example.com',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  themeUrl!: string;
}

export class GetRemoteThemeIconDto extends GetRemoteThemeDto {
  @ApiProperty({
    description: 'Icon filename (alphanumeric, dash, underscore, and dot only)',
    example: 'contoso-dark.svg',
    type: String,
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Icon name must contain only alphanumeric characters, dash, underscore, and dot',
  })
  iconName!: string;
}
