import { Injectable } from '@nestjs/common';
import { SkillsDownloadService } from './download/skills-download.service';
import { SkillsListingService } from './listing/skills-listing.service';
import { SkillsMutationService } from './mutation/skills-mutation.service';
import { SkillsUploadService } from './upload/skills-upload.service';

/*
 * Thin facade for SkillsController. Every public method here delegates to
 * exactly one focused sub-service — see
 * openspec/changes/add-skills-bff-api/design.md's service ownership map.
 * `SkillsLookupService.resolveSkillItem` is deliberately never bound here —
 * `ShareModule` injects `SkillsLookupService` directly instead (design.md D9).
 */
@Injectable()
export class SkillsService {
  constructor(
    private readonly listingService: SkillsListingService,
    private readonly downloadService: SkillsDownloadService,
    private readonly uploadService: SkillsUploadService,
    private readonly mutationService: SkillsMutationService,
  ) {}

  // Listing
  listSkills = this.listingService.listSkills.bind(this.listingService);
  listSkillFiles = this.listingService.listSkillFiles.bind(this.listingService);

  // Download
  downloadSkill = this.downloadService.downloadSkill.bind(this.downloadService);
  downloadSkillFile = this.downloadService.downloadSkillFile.bind(
    this.downloadService,
  );

  // Upload
  uploadSkill = this.uploadService.uploadSkill.bind(this.uploadService);
  uploadSkillFile = this.uploadService.uploadSkillFile.bind(this.uploadService);

  // Mutation
  deleteSkill = this.mutationService.deleteSkill.bind(this.mutationService);
  deleteSkillFile = this.mutationService.deleteSkillFile.bind(
    this.mutationService,
  );
  createSkillGroupingFolder =
    this.mutationService.createSkillGroupingFolder.bind(this.mutationService);
  deleteSkillGroupingFolder =
    this.mutationService.deleteSkillGroupingFolder.bind(this.mutationService);
}
