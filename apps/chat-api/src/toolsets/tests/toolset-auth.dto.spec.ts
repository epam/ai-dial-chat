import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ToolsetCredentialsLevel,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '../dto/toolset-auth.dto';
import { ToolsetAuthType } from '../dto/toolset-body.dto';

/* A toolset id exactly as DIAL Core returns it: spaces encoded, parentheses literal. */
const PARENTHESIZED_TOOLSET_ID =
  'toolsets/public/toolset%20with%20repair%20(%20no%20login%20happen)__0.0.1';

const LOGIN_BODY = {
  url: PARENTHESIZED_TOOLSET_ID,
  credentialsLevel: ToolsetCredentialsLevel.User,
  authenticationType: ToolsetAuthType.OAuth,
  code: 'auth-code',
  redirectUri: 'https://chat.example.com/auth/toolset-signin',
};

const validateDto = async (
  cls: typeof ToolsetLoginBodyDto | typeof ToolsetLogoutBodyDto,
  plain: Record<string, unknown>,
) =>
  validate(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ToolsetLoginBodyDto — url', () => {
  it('accepts a toolset id with literal parentheses', async () => {
    const errors = await validateDto(ToolsetLoginBodyDto, LOGIN_BODY);
    expect(errors).toHaveLength(0);
  });

  it('rejects a url with a malformed percent sequence', async () => {
    const errors = await validateDto(ToolsetLoginBodyDto, {
      ...LOGIN_BODY,
      url: 'toolsets/public/bad%2',
    });
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });

  it('rejects a url with a raw space', async () => {
    const errors = await validateDto(ToolsetLoginBodyDto, {
      ...LOGIN_BODY,
      url: 'toolsets/public/my toolset__0.0.1',
    });
    expect(errors.some((e) => e.property === 'url')).toBe(true);
  });
});

describe('ToolsetLogoutBodyDto — url', () => {
  it('accepts a toolset id with literal parentheses', async () => {
    const errors = await validateDto(ToolsetLogoutBodyDto, {
      url: PARENTHESIZED_TOOLSET_ID,
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
    expect(errors).toHaveLength(0);
  });
});
