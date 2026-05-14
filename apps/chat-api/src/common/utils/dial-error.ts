import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export const handleDialError = (error: unknown): never => {
  if (error instanceof TypeError || isNetworkError(error)) {
    throw new ServiceUnavailableException('DIAL Core is unreachable');
  }

  if (isHttpError(error)) {
    if (error.status === 404)
      throw new NotFoundException('Deployment not found');
    if (error.status === 400)
      throw new BadRequestException('Invalid request to DIAL Core');
    if (error.status >= 500)
      throw new ServiceUnavailableException(
        'DIAL Core returned a server error',
      );
  }

  throw new BadGatewayException('Unexpected response from DIAL Core');
};

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
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
};
