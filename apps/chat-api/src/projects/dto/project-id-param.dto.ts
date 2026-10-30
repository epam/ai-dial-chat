import { ApiProperty } from '@nestjs/swagger';
import { IsString, registerDecorator } from 'class-validator';
import { IsDialEntityName } from '../../common/validators/dial-entity-name.validator';
import { parseProjectId } from '../utils/project-id.util';

const PROJECT_ID_EXAMPLE = 'projects/a1b2c3/marketing/q4-launch';

/** Swagger metadata of the URL-encoded `:id` param shared by every per-project route. */
export const PROJECT_ID_PARAM = {
  name: 'id',
  description:
    'The DIAL project id `projects/{bucket}/{path}`, URL-encoded into one path segment.',
  example: 'projects%2Fa1b2c3%2Fmarketing%2Fq4-launch',
};

/** class-validator decorator: the value parses as a `projects/{bucket}/{path…}` id. */
const IsProjectId = () => (object: object, propertyName: string) => {
  registerDecorator({
    name: 'isProjectId',
    target: object.constructor,
    propertyName,
    validator: {
      validate: (value: unknown) => parseProjectId(value) != null,
      defaultMessage: () =>
        `${propertyName} must be a projects/{bucket}/{path} id whose segments are valid DIAL names`,
    },
  });
};

/** `:id` path param of the per-project endpoints. */
export class ProjectIdParamDto {
  @ApiProperty({
    description:
      'The DIAL project id `projects/{bucket}/{path}`, URL-encoded into one path segment.',
    example: PROJECT_ID_EXAMPLE,
  })
  @IsString()
  @IsProjectId()
  id!: string;
}

/** `:id` and `:fileName` path params of the context-file download. */
export class ProjectFileParamDto extends ProjectIdParamDto {
  @ApiProperty({
    description: 'Name of a file directly under the project `context/` folder.',
    example: 'tickets.csv',
  })
  @IsString()
  @IsDialEntityName()
  fileName!: string;
}
