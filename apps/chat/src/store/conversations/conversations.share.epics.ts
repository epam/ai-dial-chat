// //TODO: added for development purpose - emulate immediate sharing with yourself
// const shareFolderEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(ConversationsActions.shareFolder.match),
//     map(({ payload }) => ({
//       sharedFolderId: payload.id,
//       shareUniqueId: payload.shareUniqueId,
//       conversations: ConversationsSelectors.selectConversations(state$.value),
//       childFolders: ConversationsSelectors.selectChildAndCurrentFoldersIdsById(
//         state$.value,
//         payload.id,
//       ),
//       folders: ConversationsSelectors.selectFolders(state$.value),
//     })),
//     switchMap(
//       ({
//         sharedFolderId,
//         shareUniqueId,
//         conversations,
//         childFolders,
//         folders,
//       }) => {
//         const mapping = new Map();
//         childFolders.forEach((folderId) => mapping.set(folderId, uuidv4()));
//         const newFolders = folders
//           .filter(({ id }) => childFolders.has(id))
//           .map(({ folderId, ...folder }) => ({
//             ...folder,
//             id: mapping.get(folder.id),
//             originalId: folder.id,
//             folderId:
//               folder.id === sharedFolderId ? undefined : mapping.get(folderId), // show shared folder on root level
//             ...resetShareEntity,
//             sharedWithMe: folder.id === sharedFolderId || folder.sharedWithMe,
//             shareUniqueId:
//               folder.id === sharedFolderId ? shareUniqueId : undefined,
//           }));

//         const sharedConversations = conversations
//           .filter(
//             (conversation) =>
//               conversation.folderId && childFolders.has(conversation.folderId),
//           )
//           .map(({ folderId, ...conversation }) => ({
//             ...conversation,
//             ...resetShareEntity,
//             id: uuidv4(),
//             originalId: conversation.id,
//             folderId: mapping.get(folderId),
//           }));

//         return concat(
//           of(
//             ConversationsActions.addConversations({
//               conversations: sharedConversations,
//             }),
//           ),
//           of(
//             ConversationsActions.addFolders({
//               folders: newFolders,
//             }),
//           ),
//         );
//       },
//     ),
//   );

// //TODO: added for development purpose - emulate immediate sharing with yourself
// const shareConversationEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(ConversationsActions.shareConversation.match),
//     map(({ payload }) => ({
//       sharedConversationId: payload.id,
//       shareUniqueId: payload.shareUniqueId,
//       conversations: ConversationsSelectors.selectConversations(state$.value),
//     })),
//     switchMap(({ sharedConversationId, shareUniqueId, conversations }) => {
//       const sharedConversations = conversations
//         .filter((conversation) => conversation.id === sharedConversationId)
//         .map(({ folderId: _, ...conversation }) => ({
//           ...conversation,
//           ...resetShareEntity,
//           id: uuidv4(),
//           originalId: conversation.id,
//           folderId: undefined, // show on root level
//           sharedWithMe: true,
//           shareUniqueId,
//         }));

//       return concat(
//         of(
//           ConversationsActions.addConversations({
//             conversations: sharedConversations,
//           }),
//         ),
//       );
//     }),
//   );

// //TODO: added for development purpose - emulate immediate sharing with yourself
// const publishFolderEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(ConversationsActions.publishFolder.match),
//     map(({ payload }) => ({
//       publishRequest: payload,
//       conversations: ConversationsSelectors.selectConversations(state$.value),
//       childFolders: ConversationsSelectors.selectChildAndCurrentFoldersIdsById(
//         state$.value,
//         payload.id,
//       ),
//       folders: ConversationsSelectors.selectFolders(state$.value),
//       publishedAndTemporaryFolders:
//         ConversationsSelectors.selectTemporaryAndFilteredFolders(state$.value),
//     })),
//     switchMap(
//       ({
//         publishRequest,
//         conversations,
//         childFolders,
//         folders,
//         publishedAndTemporaryFolders,
//       }) => {
//         const mapping = new Map();
//         childFolders.forEach((folderId) => mapping.set(folderId, uuidv4()));
//         const newFolders = folders
//           .filter(({ id }) => childFolders.has(id))
//           .map(({ folderId, ...folder }) => ({
//             ...folder,
//             ...resetShareEntity,
//             id: mapping.get(folder.id),
//             originalId: folder.id,
//             folderId:
//               folder.id === publishRequest.id
//                 ? getFolderIdByPath(
//                     publishRequest.path,
//                     publishedAndTemporaryFolders,
//                   )
//                 : mapping.get(folderId),
//             name:
//               folder.id === publishRequest.id
//                 ? publishRequest.name
//                 : folder.name,
//             publishedWithMe: true,
//             shareUniqueId:
//               folder.id === publishRequest.id
//                 ? publishRequest.shareUniqueId
//                 : folder.shareUniqueId,
//             publishVersion:
//               folder.id === publishRequest.id
//                 ? publishRequest.version
//                 : folder.publishVersion,
//           }));

//         const rootFolder = findRootFromItems(newFolders);
//         const temporaryFolders = getTemporaryFoldersToPublish(
//           publishedAndTemporaryFolders,
//           rootFolder?.folderId,
//           publishRequest.version,
//         );

//         const sharedConversations = conversations
//           .filter(
//             (conversation) =>
//               conversation.folderId && childFolders.has(conversation.folderId),
//           )
//           .map(({ folderId, ...conversation }) => ({
//             ...renameAttachments(
//               conversation,
//               folderId,
//               folders,
//               publishRequest.fileNameMapping,
//             ),
//             ...resetShareEntity,
//             id: uuidv4(),
//             originalId: conversation.id,
//             folderId: mapping.get(folderId),
//           }));

//         return concat(
//           of(
//             ConversationsActions.addConversations({
//               conversations: sharedConversations,
//             }),
//           ),
//           of(
//             ConversationsActions.addFolders({
//               folders: [...temporaryFolders, ...newFolders],
//             }),
//           ),
//           of(ConversationsActions.deleteAllTemporaryFolders()),
//         );
//       },
//     ),
//   );

// //TODO: added for development purpose - emulate immediate sharing with yourself
// const publishConversationEpic: AppEpic = (action$, state$) =>
//   action$.pipe(
//     filter(ConversationsActions.publishConversation.match),
//     map(({ payload }) => ({
//       publishRequest: payload,
//       conversations: ConversationsSelectors.selectConversations(state$.value),
//       publishedAndTemporaryFolders:
//         ConversationsSelectors.selectTemporaryAndFilteredFolders(state$.value),
//       folders: ConversationsSelectors.selectFolders(state$.value),
//     })),
//     switchMap(
//       ({
//         publishRequest,
//         conversations,
//         publishedAndTemporaryFolders,
//         folders,
//       }) => {
//         const sharedConversations = conversations
//           .filter((conversation) => conversation.id === publishRequest.id)
//           .map(({ folderId, ...conversation }) => ({
//             ...renameAttachments(
//               conversation,
//               folderId,
//               folders,
//               publishRequest.fileNameMapping,
//             ),
//             ...resetShareEntity,
//             id: uuidv4(),
//             originalId: conversation.id,
//             folderId: getFolderIdByPath(
//               publishRequest.path,
//               publishedAndTemporaryFolders,
//             ),
//             publishedWithMe: true,
//             name: publishRequest.name,
//             shareUniqueId: publishRequest.shareUniqueId,
//             publishVersion: publishRequest.version,
//           }));

//         const rootItem = findRootFromItems(sharedConversations);
//         const temporaryFolders = getTemporaryFoldersToPublish(
//           publishedAndTemporaryFolders,
//           rootItem?.folderId,
//           publishRequest.version,
//         );

//         return concat(
//           of(ConversationsActions.addFolders({ folders: temporaryFolders })),
//           of(ConversationsActions.deleteAllTemporaryFolders()),
//           of(
//             ConversationsActions.addConversations({
//               conversations: sharedConversations,
//             }),
//           ),
//         );
//       },
//     ),
//   );
