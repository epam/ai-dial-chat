import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';

const VALID_INTERFACE_TYPES = [
  'chat',
  'embeddings',
  'mcp',
  'custom_ui',
  'all',
] as const;

export class DeploymentsQueryDto {
  @IsOptional()
  @IsArray()
  @IsIn(VALID_INTERFACE_TYPES, { each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  interface_type?: string[];
}
