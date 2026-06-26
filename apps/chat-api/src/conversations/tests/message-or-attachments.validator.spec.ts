import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { SendCompletionDto } from '../dto/send-completion.dto';

describe('IsMessageOrAttachmentsPresent', () => {
  it('allows empty completion text when form_value is provided', async () => {
    const dto = plainToInstance(SendCompletionDto, {
      generationId: 'test-gen-id',
      mode: 'append',
      path: 'form-example__What do you want to do',
      message: '',
      model: 'form-example',
      custom_content: {
        form_value: { button: 2 },
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows empty first message when configuration_value is provided', async () => {
    const dto = plainToInstance(CreateConversationDto, {
      firstMessage: '',
      deploymentId: 'form-example',
      custom_content: {
        configuration_value: { button: 1 },
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects empty text without custom content', async () => {
    const dto = plainToInstance(SendCompletionDto, {
      generationId: 'test-gen-id',
      mode: 'append',
      path: 'form-example__What do you want to do',
      message: '',
      model: 'form-example',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'message' }),
      ]),
    );
  });
});
