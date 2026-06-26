import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export const handleDialError = (error: unknown): never => {
  if (
    error instanceof TypeError ||
    isNetworkError(error) ||
    isTimeoutError(error)
  ) {
    throw new ServiceUnavailableException('DIAL Core is unreachable');
  }

  if (isHttpError(error)) {
    if (error.status === 400)
      throw new BadRequestException('Invalid request to DIAL Core');
    if (error.status === 401) throw new UnauthorizedException('Unauthorized');
    if (error.status === 403) throw new ForbiddenException('Forbidden');
    if (error.status === 404) throw new NotFoundException('Not found');
    if (error.status === 409) throw new ConflictException('Conflict');
    if (error.status === 413)
      throw new PayloadTooLargeException('Payload too large');
    if (error.status === 429)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (error.status >= 500)
      throw new BadGatewayException('DIAL Core returned a server error');
  }

  throw new BadGatewayException('Unexpected response from DIAL Core');
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

const isNetworkError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('fetch failed'))
  );
};

const isHttpError = (error: unknown): error is { status: number } => {
  return (
    typeof error === 'object' &&
    error != null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
};
