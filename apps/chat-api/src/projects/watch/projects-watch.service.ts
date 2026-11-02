import type { components } from '@epam/ai-dial-typescript-sdk';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodePlainDialResourcePath } from '../../common/utils/encode-dial-path';
import { createSseFrameDecoder } from '../../common/utils/sse-frame-decoder';
import { DialClientService } from '../../dial/dial-client.service';
import { PROJECTS_WATCH_MAX_FRAME_LENGTH } from '../constants/projects-watch.constants';
import type { ProjectWatchEventDto } from '../dto/project-watch-event.dto';
import { mapResourceEventToProjectEvent } from '../projects.mapper';
import { requireProjectId } from '../projects.service';

type DialResourceEvent = components['schemas']['ResourceEvent'];

const WATCH_CONTEXT = 'projects.watchProjects';
const PROJECTS_URL_PREFIX = 'projects';

/**
 * Follows listed projects through one DIAL Core resource subscription and
 * turns Core's event stream into project-level events keyed by project id.
 */
@Injectable()
export class ProjectsWatchService {
  private readonly logger = new Logger(ProjectsWatchService.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * Opens one DIAL Core subscription for every id and returns its project
   * events. Rejects with a mapped HTTP exception, before any event, when Core
   * refuses the subscription — `400` on a Core release without project
   * events, `403` when one of the projects is no longer readable.
   */
  async watchProjects(
    ids: string[],
    accessToken: string,
    signal: AbortSignal,
  ): Promise<AsyncGenerator<ProjectWatchEventDto>> {
    const parsed = ids.map(requireProjectId);
    const resources = parsed.map(({ bucket, path }) => ({
      url: `${PROJECTS_URL_PREFIX}/${bucket}/${encodePlainDialResourcePath(path)}`,
    }));

    let body: ReadableStream<Uint8Array>;
    try {
      const { response } = (await this.dialClient.client.subscribeToResources({
        body: { resources },
        headers: {
          ...getBearerAuthHeaders(accessToken),
          Accept: 'text/event-stream',
        },
        parseAs: 'stream',
        signal,
      })) as { response: globalThis.Response };

      if (!response.ok) {
        return handleDialSdkError(
          { status: response.status },
          WATCH_CONTEXT,
          this.logger,
        );
      }
      if (response.body == null) {
        this.logger.error(`DIAL Core sent no stream during ${WATCH_CONTEXT}`);
        throw new BadGatewayException('Unexpected response from DIAL Core');
      }
      body = response.body;
    } catch (err) {
      return handleDialSdkError(err, WATCH_CONTEXT, this.logger);
    }

    this.logger.debug(`Project watch opened (ids=${ids.length})`);
    return this.readEvents(body, new Set(parsed.map(({ id }) => id)));
  }

  private async *readEvents(
    body: ReadableStream<Uint8Array>,
    watchedIds: ReadonlySet<string>,
  ): AsyncGenerator<ProjectWatchEventDto> {
    const decoder = createSseFrameDecoder(PROJECTS_WATCH_MAX_FRAME_LENGTH);
    const reader = body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;

        const { events, droppedCount } = decoder.push(value);
        if (droppedCount > 0) {
          this.logger.debug(
            `Dropped ${droppedCount} oversize DIAL Core event(s)`,
          );
        }
        for (const payload of events) {
          const event = this.parseEvent(payload, watchedIds);
          if (event != null) yield event;
        }
      }
    } finally {
      /* Reached on Core ending the stream, an abort, or the consumer
       * returning early; cancelling closes the Core subscription. */
      await reader.cancel().catch(() => undefined);
    }
  }

  private parseEvent(
    payload: string,
    watchedIds: ReadonlySet<string>,
  ): ProjectWatchEventDto | null {
    try {
      const event = JSON.parse(payload) as DialResourceEvent | null;
      if (event == null || typeof event !== 'object') return null;
      return mapResourceEventToProjectEvent(event, watchedIds);
    } catch {
      this.logger.debug('Skipped a DIAL Core event that is not JSON');
      return null;
    }
  }
}
