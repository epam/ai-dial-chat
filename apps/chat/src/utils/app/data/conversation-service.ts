import { Observable } from 'rxjs';

import { Conversation } from '@/src/types/chat';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { UIStorageKeys } from '@/src/types/storage';

import { DataService } from './data-service';
import { BrowserStorage } from './storages/browser-storage';

import { ConversationInfo } from '@epam/ai-dial-shared';

export class ConversationService {
  public static getConversationsFolders(
    path?: string,
  ): Observable<FolderInterface[]> {
    return DataService.getDataStorage().getConversationsFolders(path);
  }

  public static setConversationFolders(
    folders: FolderInterface[],
  ): Observable<void> {
    return DataService.getDataStorage().setConversationsFolders(folders);
  }

  public static createConversation(
    conversation: Conversation,
  ): Observable<ConversationInfo | null> {
    return DataService.getDataStorage().createConversation(conversation);
  }

  public static updateConversation(
    conversation: Conversation,
  ): Observable<void> {
    return DataService.getDataStorage().updateConversation(conversation);
  }

  public static deleteConversation(info: ConversationInfo): Observable<void> {
    return DataService.getDataStorage().deleteConversation(info);
  }

  public static getConversationsAndFolders(
    path?: string,
  ): Observable<FoldersAndEntities<ConversationInfo>> {
    return DataService.getDataStorage().getConversationsAndFolders(path);
  }

  public static getConversations(
    path?: string,
    recursive?: boolean,
  ): Observable<ConversationInfo[]> {
    return DataService.getDataStorage().getConversations(path, recursive);
  }

  public static getMultipleFoldersConversations(
    paths: string[],
    recursive?: boolean,
  ): Observable<ConversationInfo[]> {
    return DataService.getDataStorage().getMultipleFoldersConversations(
      paths,
      recursive,
    );
  }

  // TODO: allow to pass only path, because it's hard to create full object every time
  public static getConversation(
    info: ConversationInfo,
  ): Observable<Conversation | null> {
    return DataService.getDataStorage().getConversation(info);
  }

  public static setConversations(
    conversations: Conversation[],
  ): Observable<ConversationInfo> {
    return DataService.getDataStorage().setConversations(conversations);
  }

  public static getSelectedConversationsIds(): Observable<string[]> {
    return BrowserStorage.getData(UIStorageKeys.SelectedConversationIds, []);
  }

  public static setSelectedConversationsIds(
    selectedConversationsIds: string[],
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.SelectedConversationIds,
      selectedConversationsIds,
    );
  }
}
