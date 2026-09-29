import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DeploymentType } from '../../dto/deployment-type';
import { UserStatsQueryDto } from '../../dto/user-stats-query.dto';

const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(UserStatsQueryDto, query);
  return { dto, errors: validateSync(dto) };
};

describe('UserStatsQueryDto', () => {
  it('leaves deploymentTypes undefined when the parameter is absent', () => {
    const { dto, errors } = parse({});
    expect(errors).toEqual([]);
    expect(dto.deploymentTypes).toBeUndefined();
  });

  it.each([
    ['comma-separated', 'model,application'],
    ['repeated keys', ['model', 'application']],
    ['mixed forms', ['model,application', 'model']],
    ['padded and empty entries', ' model , ,application,'],
    ['duplicates', 'model,model,application'],
  ])('normalizes %s to both kinds in order', (_label, value) => {
    const { dto, errors } = parse({ deploymentTypes: value });
    expect(errors).toEqual([]);
    expect(dto.deploymentTypes).toEqual([
      DeploymentType.Model,
      DeploymentType.Application,
    ]);
  });

  it('keeps the order the caller gave', () => {
    const { dto } = parse({ deploymentTypes: 'application,model' });
    expect(dto.deploymentTypes).toEqual([
      DeploymentType.Application,
      DeploymentType.Model,
    ]);
  });

  it.each(['route', 'toolset', 'MODEL', 'model,route'])(
    'rejects %s',
    (value) => {
      const { errors } = parse({ deploymentTypes: value });
      expect(errors.map((error) => error.property)).toEqual([
        'deploymentTypes',
      ]);
    },
  );
});
