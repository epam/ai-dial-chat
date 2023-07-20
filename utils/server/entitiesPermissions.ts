import { Session } from 'next-auth';

import { OpenAIEntity } from '@/types/openai';

export function limitEntitiesAccordingToUser<T extends OpenAIEntity>(
  entities: T[],
  session: Session | null,
  entityPermissions: string | undefined,
): T[] {
  if (!entityPermissions) {
    return entities;
  }

  const entitiesLimitations: Record<string, Set<string>> = entityPermissions
    .split('|')
    .map((userLimitations) => {
      const [entityId, emailsString] = userLimitations.split('=');
      return {
        entityId,
        emails: new Set(emailsString.split(',')),
      };
    })
      .reduce((acc, curr) => {
      acc[curr.entityId] = curr.emails;

      return acc;
    }, {} as Record<string, Set<string>>);

  entities = entities.filter((model) => {
    if (!entitiesLimitations[model.id]) {
      return true;
    }
    if (!session?.user?.email) {
      return false;
    }

    return entitiesLimitations[model.id].has(session?.user?.email);
  });
  return entities;
}
