export const SHARE_QUERY_PARAM = 'share';

export const shareApiErrorsRegex = {
  applicationWithPublicFiles: new RegExp(
    /^all files in the application .+ should belong to a requester$/,
  ),
};
