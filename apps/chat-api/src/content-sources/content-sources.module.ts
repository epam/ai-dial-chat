import { createKeyv, KeyvCacheableMemory } from '@cacheable/memory';
import { Module } from '@nestjs/common';
import { createCache } from 'cache-manager';
import { ContentSourcesAdmissionService } from './content-sources-admission.service';
import {
  CONTENT_SOURCES_CACHE,
  ContentSourcesCacheService,
  ContentSourcesCaches,
} from './content-sources-cache.service';
import {
  CONTENT_SOURCES_MAX_DOCUMENTS,
  CONTENT_SOURCES_MAX_SOURCES,
  ContentSourcesRegistryService,
} from './content-sources-registry.service';
import { ContentSourcesController } from './content-sources.controller';
import { ContentSourcesService } from './content-sources.service';
import { GitHubProvider } from './providers/github.provider';
import { GitLabProvider } from './providers/gitlab.provider';

/*
 * Capacity, derived from the registry ceilings rather than guessed:
 * - Meta: per source, one listing plus one date entry per document, for the
 *   most sources a registry may hold. Entries are small (a few hundred bytes;
 *   a listing is tens of KB), so the count is the bound that matters.
 * - Content: documents and assets up to CONTENT_SOURCES_MAX_CACHED_ENTRY_BYTES
 *   each; larger ones are streamed through uncached. 128 entries therefore
 *   hold at most 64 MiB.
 */
export const CONTENT_SOURCES_META_MAX_ENTRIES =
  CONTENT_SOURCES_MAX_SOURCES * (CONTENT_SOURCES_MAX_DOCUMENTS + 1);
export const CONTENT_SOURCES_CONTENT_MAX_ENTRIES = 128;
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;

const createBoundedCache = (lruSize: number) => {
  const keyv = createKeyv({
    lruSize,
    checkInterval: CACHE_CLEANUP_INTERVAL_MS,
    useClone: false,
  });
  const memory = (keyv.store as KeyvCacheableMemory).store;
  keyv.on('disconnect', () => {
    memory.stopIntervalCheck();
    memory.clear();
  });
  return createCache({ stores: [keyv] });
};

/*
 * Dedicated stores: the app-wide cache holds 100 small shared entries, and one
 * 200-document listing would evict all of them. Reference semantics keep
 * Buffer values uncloned.
 */
export const createContentSourcesCaches = (): ContentSourcesCaches => ({
  meta: createBoundedCache(CONTENT_SOURCES_META_MAX_ENTRIES),
  content: createBoundedCache(CONTENT_SOURCES_CONTENT_MAX_ENTRIES),
});

@Module({
  controllers: [ContentSourcesController],
  providers: [
    { provide: CONTENT_SOURCES_CACHE, useFactory: createContentSourcesCaches },
    ContentSourcesRegistryService,
    ContentSourcesCacheService,
    ContentSourcesAdmissionService,
    ContentSourcesService,
    GitHubProvider,
    GitLabProvider,
  ],
})
export class ContentSourcesModule {}
