/** A resolved Custom Viewer: a page that replaces the conversation UI for an application. */
export interface CustomViewer {
  /** Absolute `http:`/`https:` URL of the viewer page. */
  url: string;
  /** postMessage namespace (`<title>/<EVENT>`); must equal the viewer's own `appName`. */
  title: string;
  /** Id of the application the viewer is configured for. */
  applicationId: string;
}

/** Inputs for the viewer iframe `src`. */
export interface CustomViewerUrlParams {
  /** Configured viewer URL; any query string it already has is kept. */
  url: string;
  /** Application (deployment) id, sent as `id`. */
  applicationId: string;
  /** DIAL id of the open conversation, sent as `conversationId`. */
  conversationId?: string;
  /** Resolved theme id, sent as `theme`. */
  theme?: string;
  /** Auth provider id, sent as `authProvider`. */
  authProvider?: string;
}
