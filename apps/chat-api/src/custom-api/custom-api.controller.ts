import {
  applyDecorators,
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
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { CustomApiAdmissionService } from './custom-api-admission.service';
import {
  CustomApiMethod,
  CustomApiRegistryService,
} from './custom-api-registry.service';
import { parseCustomApiRequest } from './custom-api-request';
import {
  CustomApiResultCategory,
  recordCustomApiCall,
} from './custom-api-telemetry';
import {
  CLIENT_CLOSED_REQUEST_STATUS,
  CustomApiService,
} from './custom-api.service';
import { CustomApiOperationParamsDto } from './dto/custom-api-operation-params.dto';
import { CustomApiResponseDto } from './dto/custom-api-response.dto';

const rejectUnsupportedMethod = (): never => {
  throw new MethodNotAllowedException(
    'HEAD and PATCH are not supported for custom API operations',
  );
};

/** Builds the admission/telemetry principal key from the authenticated user. */
const resolvePrincipalKey = (user: SessionUser): string =>
  `${user.providerId}:${user.sub}`;

/*
 * Shared by every operation's description: the query allowlist is per
 * deployment, so OpenAPI cannot declare it, and a free-form object parameter
 * would be serialized by the generated client as `params[name]=…`.
 */
const QUERY_NOTE =
  ' Query parameters are accepted only by the names the operation allowlists ' +
  '(each at most once); they are not declared here because each deployment ' +
  'configures its own. A caller passing them builds the request URL itself on ' +
  "the generated client's Configuration.fetchApi — a documented generator gap.";

const OPERATION_DESCRIPTION =
  'Dispatches an authenticated request to the exact Core path configured for this ' +
  "operation ID under CUSTOM_CORE_API_CONFIG, using the caller's own session access " +
  "token and the operation's configured method; a different method returns 405. Core " +
  'remains the authority for route role authorization and business rate limits; this ' +
  'endpoint adds no BFF business schema or field filtering, so the response is an ' +
  'opaque JSON value the calling application must validate for its own domain.' +
  QUERY_NOTE;

/*
 * The opaque JSON body of a write, documented as a free-form object like the
 * response envelope's `data`. Not a class: an empty DTO would render as a
 * schema with no properties, and a `@Body()`-bound class would make the
 * global ValidationPipe reject every property of the upstream's own shape.
 */
const REQUEST_BODY = {
  required: false,
  description:
    'JSON object or array for an operation configured with body "json" (at most 65,536 bytes, depth 32); omitted for every other operation.',
  schema: { type: 'object', additionalProperties: true },
} as const;

/** The shared Swagger shape of every dispatching handler. */
const ApiCustomApiResponses = () =>
  applyDecorators(
    ApiDialCoreErrors({ exclude: [HttpStatus.PAYLOAD_TOO_LARGE] }),
    ApiResponse({
      status: 200,
      description:
        'The configured operation succeeded (Core 200 or 201; Core 204 returns data null)',
      type: CustomApiResponseDto,
    }),
    ApiResponse({
      status: 400,
      description:
        'Invalid operation ID, a query parameter the operation does not allow, or a body it does not accept',
    }),
    ApiResponse({
      status: 401,
      description: 'Not authenticated — valid session cookie required',
    }),
    ApiResponse({
      status: 404,
      description:
        'No operation is configured for this ID, or DIAL Core reported the resource as not found',
    }),
    ApiResponse({
      status: 405,
      description:
        "The request method is not the operation's configured method",
    }),
    ApiResponse({
      status: 429,
      description:
        'Local in-flight call capacity exhausted, or DIAL Core rate-limited the call',
    }),
    ApiResponse({
      status: 502,
      description:
        'DIAL Core returned an error, a redirect, or an invalid/oversized response',
    }),
    ApiResponse({ status: 503, description: 'DIAL Core is unreachable' }),
    ApiResponse({
      status: 504,
      description: 'DIAL Core request exceeded its configured deadline',
    }),
  );

@ApiTags('custom-api')
@Controller({ path: 'custom-api', version: '1' })
export class CustomApiController {
  constructor(
    private readonly registry: CustomApiRegistryService,
    private readonly customApiService: CustomApiService,
    private readonly admission: CustomApiAdmissionService,
  ) {}

  /*
   * HEAD and PATCH are never configurable. They are declared before the GET
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

  @Patch(':id')
  @ApiExcludeEndpoint()
  rejectPatch(): never {
    return rejectUnsupportedMethod();
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getCustomApiOperation',
    summary: 'Call a deployment-configured custom Core API GET operation',
    description: OPERATION_DESCRIPTION,
  })
  @ApiCustomApiResponses()
  getCustomApiOperation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: CustomApiOperationParamsDto,
  ): Promise<CustomApiResponseDto> {
    return this.dispatch(CustomApiMethod.Get, req, res, params);
  }

  /*
   * Writes read their body from `req.body`, not a `@Body()`-bound DTO: the
   * global ValidationPipe runs with `forbidNonWhitelisted`, which would reject
   * every property of an opaque JSON body. `@ApiBody` documents it instead,
   * and custom-api-request.ts validates it against the operation.
   */
  @Post(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'postCustomApiOperation',
    summary: 'Call a deployment-configured custom Core API POST operation',
    description: OPERATION_DESCRIPTION,
  })
  @ApiBody(REQUEST_BODY)
  @ApiCustomApiResponses()
  postCustomApiOperation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: CustomApiOperationParamsDto,
  ): Promise<CustomApiResponseDto> {
    return this.dispatch(CustomApiMethod.Post, req, res, params);
  }

  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'putCustomApiOperation',
    summary: 'Call a deployment-configured custom Core API PUT operation',
    description: OPERATION_DESCRIPTION,
  })
  @ApiBody(REQUEST_BODY)
  @ApiCustomApiResponses()
  putCustomApiOperation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: CustomApiOperationParamsDto,
  ): Promise<CustomApiResponseDto> {
    return this.dispatch(CustomApiMethod.Put, req, res, params);
  }

  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'deleteCustomApiOperation',
    summary: 'Call a deployment-configured custom Core API DELETE operation',
    description: OPERATION_DESCRIPTION,
  })
  @ApiCustomApiResponses()
  deleteCustomApiOperation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: CustomApiOperationParamsDto,
  ): Promise<CustomApiResponseDto> {
    return this.dispatch(CustomApiMethod.Delete, req, res, params);
  }

  /*
   * One path for every method: resolve, check the method, validate the
   * caller's query and body, then admit and dispatch. Everything that can
   * refuse the request does so before admission, so a refused request never
   * holds capacity.
   */
  private async dispatch(
    method: CustomApiMethod,
    req: Request,
    res: Response,
    params: CustomApiOperationParamsDto,
  ): Promise<CustomApiResponseDto> {
    const operation = this.registry.get(params.id);
    if (!operation) {
      recordCustomApiCall({
        operationId: undefined,
        known: false,
        method,
        result: CustomApiResultCategory.NotFound,
        durationSeconds: 0,
      });
      throw new NotFoundException('Unknown custom API operation');
    }

    if (operation.method !== method) {
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        method,
        result: CustomApiResultCategory.UnsupportedMethod,
        durationSeconds: 0,
      });
      throw new MethodNotAllowedException(
        "The request method is not this operation's configured method",
      );
    }

    const input = parseCustomApiRequest(req, operation);

    const user = req.user as SessionUser;
    const principalKey = resolvePrincipalKey(user);

    if (!this.admission.tryAcquire(principalKey)) {
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        method,
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
        input,
      );
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        method,
        result: CustomApiResultCategory.Success,
        durationSeconds: elapsedSeconds(startedAt),
        bytes,
      });
      return { data };
    } catch (error) {
      recordCustomApiCall({
        operationId: operation.id,
        known: true,
        method,
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
