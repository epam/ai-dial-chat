import { BadRequestException } from '@nestjs/common';

/*
 * DIAL Core's client-channel id is an opaque token this service must forward
 * unchanged and may log — validated here before it ever reaches a log line
 * or an upstream header.
 */
export const CHANNEL_ID_PATTERN = /^[\w.-]{1,256}$/;

export const assertValidChannelId = (
  channelId: string | string[] | undefined,
): string => {
  if (typeof channelId !== 'string' || !CHANNEL_ID_PATTERN.test(channelId)) {
    throw new BadRequestException(
      'X-DIAL-CLIENT-CHANNEL-ID header is missing or invalid',
    );
  }
  return channelId;
};

/**
 * Same allowlist check as {@link assertValidChannelId}, but for the
 * `subscribe` reconnect header, which is optional — an absent header is
 * valid (fresh subscribe), while a present-but-malformed one is rejected
 * before it reaches a log line or an upstream request.
 */
export const assertValidOptionalChannelId = (
  channelId: string | string[] | undefined,
): string | undefined => {
  if (channelId === undefined) return undefined;
  return assertValidChannelId(channelId);
};
