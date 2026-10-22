import { Module } from '@nestjs/common';
import { FilesListingService } from './files-listing.service';

/**
 * Exposes `FilesListingService` without `FilesModule`'s controller, so a domain
 * that only needs to list files (conversation publish expands attached
 * folders) can use it without importing the whole files module.
 */
@Module({
  providers: [FilesListingService],
  exports: [FilesListingService],
})
export class FilesListingModule {}
