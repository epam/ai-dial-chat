import type { ReactNode } from 'react';
import type { CatalogItem } from './catalog-item';

/**
 * What the details panel hands a host-drawn identity block
 * (`renderDetailsIdentity`). The parts the panel builds from its own state
 * come as ready nodes, so the host can place them without rebuilding them.
 */
export interface CatalogDetailsIdentityRenderProps {
  /** The item the panel shows. */
  item: CatalogItem;
  /** The limit-status badge ("Running low" / "Limit reached"); absent when the item reports no limit status. */
  statusBadge?: ReactNode;
  /** The item's folder path; absent when the item is not in a folder. */
  footer?: ReactNode;
}

/** What the About tab hands a host-drawn footer (`renderAboutFooter`). */
export interface CatalogAboutFooterRenderProps {
  /** The item the panel shows. */
  item: CatalogItem;
}
