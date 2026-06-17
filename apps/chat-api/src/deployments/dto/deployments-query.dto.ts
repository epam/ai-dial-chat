import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';

export enum DeploymentInterfaceType {
  Chat = 'chat',
  Embeddings = 'embeddings',
  Mcp = 'mcp',
  CustomUi = 'custom_ui',
  All = 'all',
}

const VALID_INTERFACE_TYPES = Object.values(DeploymentInterfaceType);

export class DeploymentsQueryDto {
  @IsOptional()
  @IsArray()
  @IsIn(VALID_INTERFACE_TYPES, { each: true })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') return value.split(',');
    return value;
  })
  interface_type?: DeploymentInterfaceType[];
}
