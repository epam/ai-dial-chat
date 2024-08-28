export const errorsMessages = {
  generalClient: 'error.general_client.message',
  generalServer: 'error.general_server.message',
  429: 'error.429.message',
  401: 'error.401.message',
  403: 'error.403.message',
  400: 'error.400.message',
  contentFiltering: 'error.content_filtering.message',
  unsupportedConversationsDataFormat:
    'error.unsupported_conversations_data_format.message',
  unsupportedPromptsDataFormat: 'error.unsupported_prompts_data_format.message',
  localStorageQuotaExceeded: 'error.local_storage_quota_exceeded.message',
  timeoutError: 'error.timeout_error.message',
  customThemesConfigNotProvided:
    'error.custom_themes_config_not_provided.message',
  errorDuringEntityRequest: (entityType: string) =>
    `Error happened during ${entityType} request. Please try again later.`,
  errorGettingUserBucket: 'error.error_getting_user_bucket.message',
  noModelsAvailable: 'error.no_models_available.message',
  importConversationsFailed: 'error.import_conversations_failed.message',
  importPromptsFailed: 'error.import_prompts_failed.message',
  exportFailed: 'error.export_failed.message',
  shareFailed: 'error.share_failed.message',
  acceptShareFailed: 'error.accept_share_failed.message',
  acceptShareNotExists: 'error.accept_share_not_exists.message',
  revokeAccessFailed: 'error.revoke_access_failed.message',
  discardSharedWithMeFailed: 'error.discard_shared_with_me_failed.message',
  shareByMeListingFailed: 'error.share_by_me_listing_failed.message',
  shareWithMeListingFailed: 'error.share_with_me_listing_failed.message',
  notValidEntityType: 'error.not_valid_entity_type.message',

  entityNameInvalid: 'chat.chat_input.name_is_invalid.text',
  entityPathInvalid: 'chat.chat_input.path_is_invalid.text',
  entityNameInvalidExternal: 'chat.chat_input.name_is_invalid.text',
  entityPathInvalidExternal: 'chat.chat_input.path_is_invalid.text',

  publicationFailed: 'error.publication_failed.message',
  publicationsUploadFailed: 'error.publications_upload_failed.message',
  publicationUploadFailed: 'error.publication_upload_failed.message',
  publicationDeletionFailed: 'error.publication_deletion_failed.message',
  publishedItemsUploadFailed: 'error.published_items_upload_failed.message',
  publicationApproveFailed: 'error.publication_approve_failed.message',
  publicationRejectFailed: 'error.publication_reject_failed.message',
  publishingByMeItemsUploadingFailed:
    'error.publishing_by_me_items_uploading_failed.message',
  rulesUploadingFailed: 'error.rules_uploading_failed.message',
  uploadPromptsAndFoldersFailed:
    'error.upload_prompts_and_folders_failed.message',
  saveConversationFailed: 'error.save_conversation_failed.message',
  fetchingModelsFailed: 'error.fetching_models_failed.message',
  uploadingChartDataFailed: 'error.uploading_chart_data_failed.message',
  conversationDeletedPleaseReloadPage:
    'error.conversation_deleted_please_reload_page.message',
  loadingConversationAndFoldersFailed:
    'error.loading_conversation_and_folders_failed.message',
  creatingNewConversationFailed:
    'error.creating_new_conversation_failed.message',
  savingConversationFailed: 'error.saving_conversation_failed.message',
  deletingConversationFailed: 'error.deleting_conversation_failed.message',
  conversationNotExistForRating:
    'error.conversation_not_exist_for_rating.message',
  messageRatingFailed: 'error.message_rating_failed.message',
  savingConversationFoldersFailed:
    'error.saving_conversation_folders_failed.message',
  deletingFileFailed: 'error.deleting_file_failed.message',
  uploadingConversationFailed: 'error.uploading_conversation_failed.message',
  uploadingConversationsFailed: 'error.uploading_conversations_failed.message',
  uploadingConversationsAndFoldersFailed:
    'error.uploading_conversations_and_folders_failed.message',
  uploadingPromptFailed: 'error.uploading_prompt_failed.message',
  uploadingPromptsFailed: 'error.uploading_prompts_failed.message',
  uploadingPromptsAndFoldersFailed:
    'error.uploading_prompts_and_folders_failed.message',
  promptDeletedPleaseReloadPage:
    'error.prompt_deleted_please_reload_page.message',
  creatingNewPromptFailed: 'error.creating_new_prompt_failed.message',
  savingPromptFailed: 'error.saving_prompt_failed.message',
  savingFoldersFailed: 'error.saving_folders_failed.message',
  deletingPromptFailed: 'error.deleting_prompt_failed.message',
  updatingFolderFailed: 'error.updating_folder_failed.message',
};
