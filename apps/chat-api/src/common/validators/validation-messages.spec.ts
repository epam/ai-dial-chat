import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateConversationDto } from '../../conversations/dto/create-conversation.dto';
import { ListFilesQueryDto } from '../../files/dto/list-files.dto';

const messagesFor = async (
  cls: new () => object,
  plain: Record<string, unknown>,
  property: string,
): Promise<string[]> => {
  const errors = await validate(plainToInstance(cls, plain));
  const error = errors.find((e) => e.property === property);
  return Object.values(error?.constraints ?? {});
};

describe('shared validation messages', () => {
  it('names the bucket field when the bucket pattern fails', async () => {
    const messages = await messagesFor(
      ListFilesQueryDto,
      { bucket: 'my/bucket' },
      'bucket',
    );
    expect(messages).toContain(
      'bucket must contain only letters, digits, underscores, dots, or hyphens',
    );
  });

  it('names the deploymentId field when the deployment id pattern fails', async () => {
    const messages = await messagesFor(
      CreateConversationDto,
      { deploymentId: 'bad id!', firstMessage: 'Hello' },
      'deploymentId',
    );
    expect(messages).toContain(
      'deploymentId must contain only supported characters or valid percent-encoded bytes',
    );
  });
});
