import { Injectable } from '@nestjs/common';
import { ProviderContext } from './content-provider';
import {
  ContentSource,
  ContentSourcesRegistryService,
} from './content-sources-registry.service';
import { recordContentSourceQueueWait } from './content-sources-telemetry';
import { fetchUpstream, UpstreamResponse } from './upstream-fetch';
import { UpstreamGate } from './upstream-gate';

/** What a provider decides about one upstream GET; the rest comes from the source. */
export interface ContentSourceUpstreamRequest {
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly maxBytes: number;
}

/*
 * Pool identity: hosting providers meter quotas per token, so sources sharing
 * an origin and credential share one limit. Never logged or used as a label.
 */
const poolKey = (source: ContentSource): string =>
  `${source.baseUrl}\n${source.credentialId ?? ''}`;

/**
 * The only path from a provider to the network. Every upstream call waits for
 * a slot of its `baseUrl` + `credentialId` pool (FIFO, bounded queue, wait
 * deadline `CONTENT_SOURCES_TIMEOUT_MS`), so upstream concurrency is bounded
 * by construction. The same setting is the wait deadline and, once admitted,
 * the call's own deadline. Pools are created on first use; their keys come only from
 * validated configuration, so there are never more pools than sources.
 */
@Injectable()
export class ContentSourcesUpstreamService {
  private readonly gates = new Map<string, UpstreamGate>();

  constructor(private readonly registry: ContentSourcesRegistryService) {}

  fetch(
    source: ContentSource,
    request: ContentSourceUpstreamRequest,
    context: ProviderContext,
  ): Promise<UpstreamResponse> {
    return this.gate(source).run(
      () =>
        fetchUpstream({
          url: request.url,
          origin: new URL(source.baseUrl).origin,
          headers: request.headers,
          timeoutMs: this.registry.timeoutMs,
          maxBytes: request.maxBytes,
          sourceId: source.id,
          signal: context.signal,
        }),
      {
        waitMs: this.registry.timeoutMs,
        signal: context.signal,
        isQueueLimitExempt: context.isQueueLimitExempt,
        onQueueOutcome: (outcome, waitSeconds) =>
          recordContentSourceQueueWait(source.id, waitSeconds, outcome),
      },
    );
  }

  private gate(source: ContentSource): UpstreamGate {
    const key = poolKey(source);
    let gate = this.gates.get(key);
    if (!gate) {
      gate = new UpstreamGate({
        concurrency: this.registry.upstreamConcurrency,
        queueSize: this.registry.upstreamQueueSize,
      });
      this.gates.set(key, gate);
    }
    return gate;
  }
}
