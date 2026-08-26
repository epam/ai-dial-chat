import { Transform } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsUrl } from 'class-validator';

/** Validated environment variables for the MCP Apps sandbox-proxy app. */
export class EnvironmentVariables {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT?: number = 3100;

  /**
   * Comma-separated list of allowed host origins (e.g.
   * `https://chat.example.com`). A request's `Referer` header must resolve
   * to an origin in this list or the sandbox page is not served (403).
   * Left unset at boot is valid — every request is then rejected until an
   * operator configures it, per the "absence isn't failure" posture used
   * elsewhere in this change (no insecure default that serves to any origin).
   */
  @IsOptional()
  @Transform(({ value }: { value?: string }) =>
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS?: string[];
}
