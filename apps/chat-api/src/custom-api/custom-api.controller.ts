import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Head,
  Header,
  HttpException,
  HttpStatus,
  MethodNotAllowedException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { CustomApiAdmissionService } from './custom-api-admission.service';
import { CustomApiRegistryService } from './custom-api-registry.service';
import {
  CustomApiResultCategory,
  recordCustomApiCall,
} from './custom-api-telemetry';
import {
  CLIENT_CLOSED_REQUEST_STATUS,
  CustomApiService,
} from './custom-api.service';
import { CustomApiEmptyQueryDto } from './dto/custom-api-empty.dto';
import { CustomApiOperationParamsDto } from './dto/custom-api-operation-params.dto';
import { CustomApiResponseDto } from './dto/custom-api-response.dto';

const rejectUnsupportedMethod = (): never => {
  throw new MethodNotAllowedException(
    'Only GET is supported for custom API operations',
  );
};

/** Builds the admission/telemetry principal key from the authenticated user. */
const resolvePrincipalKey = (user: SessionUser): string =>
  `${user.providerId}:${user.sub}`;

@ApiTags('custom-api')
@Controller({ path: 'custom-api', version: '1' })
export class CustomApiController {
  constructor(
    private readonly registry: CustomApiRegistryService,
    private readonly customApiService: CustomApiService,
    private readonly admission: CustomApiAdmissionService,
  ) {}

  /*
   * Explicit rejections for every other verb, declared before the GET
   * handler so HEAD is matched here rather than falling back to Express's
   * implicit HEAD-to-GET dispatch on the `@Get` route below. OPTIONS is
   * intentionally not declared — it stays local under existing CORS
   * middleware behavior.
   */
  @Head(':id')
  @ApiExcludeEndpoint()
  rejectHead(): never {
    return rejectUnsupportedMethod();
  }

  @Post(':id')
  @ApiExcludeEndpoint()
  rejectPost(): never {
    return rejectUnsupportedMethod();
  }

  @Put(':id')
  @ApiExcludeEndpoint()
  rejectPut(): never {
    return rejectUnsupportedMethod();
  }

  @Patch(':id')
  @ApiExcludeEndpoint()
  rejectPatch(): never {
    return rejectUnsupportedMethod();
  }

  @Delete(':id')
  @ApiExcludeEndpoint()
  rejectDelete(): never {
    return rejectUnsupportedMethod();
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getCustomApiOperation',
    summary: 'Call a deployment-configured custom Core API operation',
    description:
      'Dispatches an authenticated GET request to the exact Core path configured for this ' +
      "operation ID under CUSTOM_CORE_API_CONFIG, using the caller's own session access " +
      'token. Accepts no query parameters and no request body. Core remains the authority ' +
      'for route role authorization and business rate limits; this endpoint adds no BFF ' +
      'business schema or field filtering, so the response is an opaque JSON value the ' +
      'calling application must validate for its own domain.',
  })
  @ApiDialCoreErrors({ exclude: [HttpStatus.PAYLOAD_TOO_LARGE] })
  @ApiResponse({
    status: 200,
    description: 'The configured operation succeeded',
    type: CustomApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid operation ID, or a query/body value was supplied',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 404,
    description:
      'No operation is configured for this ID, or DIAL Core reported the resource as not found',
  })
  @ApiResponse({
    status: 405,
    description: 'Only GET is supported for custom API operations',
  })
  @ApiResponse({
    status: 429,
    description:
      'Local in-flight call capacity exhausted, or DIAL Core rate-limited the call',
  })
  @ApiResponse({
    status: 502,
    description:
      'DIAL Core returned an error, a redirect, or an invalid/oversized response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unreachable',
  })
  @ApiResponse({
    status: 504,
    description: 'DIAL Core request exceeded its configured deadline',
  })
  async getCustomApiOperation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: CustomApiOperationParamsDto,
    @Query() _query: CustomApiEmptyQueryDto,
  ): Promise<CustomApiResponseDto> {
    /*
     * Deliberately not a `@Body()`-bound DTO: NestJS Swagger documents any
     * `@Body()` parameter as a requestBody regardless of the DTO's (empty)
     * shape, which the OpenAPI generator then renders as a public `body: any`
     * SDK parameter — exactly the query/body contract `openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md` §3 forbids.
     * A manual check against the raw framing headers and the parsed body
     * still rejects a nonempty payload with 400 before dispatch, without
     * adding one to the contract.
     */
    if (hasNonEmptyBody(req)) {
      throw new BadRequestException('This operation accepts no request body');
    }

    const operation = this.registry.get(params.id);
    if (!operation) {
      recordCustomApiCall({
        operationId: undefined,
        known: false,
        result: CustomApiResultCategory.NotFound,
        durationSeconds: 0,
      });
      throw new NotFoundException('Unknown custom API operation');
    }

    const user = req.user as SessionUser;
    const principalKey = resolvePrincipalKey(user);

    if (!this.admission.tryAcquire(principalKey)) {
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        result: CustomApiResultCategory.AdmissionRejected,
        durationSeconds: 0,
      });
      throw new HttpException(
        'Too many concurrent custom API calls',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    /* A client disconnect aborts the in-flight Core call and frees the permit. */
    const clientAbort = new AbortController();
    const handleClose = () => {
      if (!res.writableEnded) {
        clientAbort.abort();
      }
    };
    res.on('close', handleClose);

    const startedAt = process.hrtime.bigint();
    try {
      const { data, bytes } = await this.customApiService.callOperation(
        operation,
        user.at,
        clientAbort.signal,
      );
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        result: CustomApiResultCategory.Success,
        durationSeconds: elapsedSeconds(startedAt),
        bytes,
      });
      return { data };
    } catch (error) {
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        result: classifyFailure(error),
        durationSeconds: elapsedSeconds(startedAt),
      });
      throw error;
    } finally {
      res.off('close', handleClose);
      this.admission.release(principalKey);
    }
  }
}

/**
 * True when the request declares a payload (a positive `Content-Length` or
 * any `Transfer-Encoding`, which covers content types no body parser reads)
 * or carries a parsed body beyond Express's default empty `{}`.
 */
const hasNonEmptyBody = (req: Request): boolean => {
  if (req.headers?.['transfer-encoding'] != null) return true;
  if (Number(req.headers?.['content-length'] ?? 0) > 0) return true;
  const body: unknown = req.body;
  if (body == null) return false;
  if (typeof body === 'object') return Object.keys(body).length > 0;
  return true;
};

const elapsedSeconds = (startedAt: bigint): number =>
  Number(process.hrtime.bigint() - startedAt) / 1e9;

const classifyFailure = (error: unknown): CustomApiResultCategory => {
  if (!(error instanceof HttpException)) {
    return CustomApiResultCategory.InternalError;
  }
  const status = error.getStatus();
  if (status === CLIENT_CLOSED_REQUEST_STATUS) {
    return CustomApiResultCategory.ClientClosed;
  }
  if (status === HttpStatus.GATEWAY_TIMEOUT) {
    return CustomApiResultCategory.Timeout;
  }
  if (status === HttpStatus.SERVICE_UNAVAILABLE) {
    return CustomApiResultCategory.Unavailable;
  }
  if (status === HttpStatus.BAD_GATEWAY) {
    return CustomApiResultCategory.UpstreamError;
  }
  if (status >= 400 && status < 500) {
    return CustomApiResultCategory.UpstreamClientError;
  }
  return CustomApiResultCategory.InternalError;
};
