import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

/*
 * DIAL Core's RpcRequest/RpcResponse `id` field is an opaque, untyped JSON
 * node in the client-channel OpenAPI schema — this allowlist is chat-api's
 * own trust boundary for it, since the value is echoed back to Core and may
 * end up in log lines.
 */
export const RPC_ID_PATTERN = /^[\w-]+$/;
const RPC_ID_MESSAGE =
  'Must contain only letters, digits, dashes, and underscores';

export enum ToolsetSigninResult {
  Success = 'success',
  Denied = 'denied',
}

export class ReportClientChannelDto {
  @ApiProperty({
    description: 'The `id` of the RPC request being answered.',
    example: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  })
  @IsString()
  @MaxLength(256)
  @Matches(RPC_ID_PATTERN, { message: RPC_ID_MESSAGE })
  id!: string;

  @ApiProperty({
    enum: ToolsetSigninResult,
    example: ToolsetSigninResult.Success,
  })
  @IsEnum(ToolsetSigninResult)
  result!: ToolsetSigninResult;
}
