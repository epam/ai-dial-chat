import { registerDecorator, ValidationOptions } from 'class-validator';
import { isProjectConversationLocator } from '../../projects/utils/project-conversation-id.util';

/**
 * Property decorator that rejects a project conversation locator
 * (`projects/{bucket}/{path}/conversations/{name}`). The regular conversation
 * routes must not reach a project's conversations: only the project
 * conversation endpoints apply the projects feature flag and the owner check.
 * A project completion body carries the locator without `projects/`, so it
 * passes.
 */
export const IsNotProjectConversationLocator = (
  validationOptions?: ValidationOptions,
) => {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isNotProjectConversationLocator',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must not name a project conversation`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown): boolean =>
          !isProjectConversationLocator(value),
      },
    });
  };
};
