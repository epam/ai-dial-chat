import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentErrorReason,
  AttachmentType,
  CodeBlockTheme,
  DisplayAttachment,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import {
  AssistantMessageBubble,
  UserMessageBubble,
} from '@epam/ai-dial-conversation-messages';
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-pdf-highlighter/styles.css';
import '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './app/app';
import { RootErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import NotificationContainer from './components/Notification/NotificationContainer';
import RequireAuth from './components/RequireAuth/RequireAuth';
import AppConfigProvider from './context/AppConfigContext';
import { UserProvider } from './context/auth/UserContext';
import { ConversationsProvider } from './context/ConversationsContext';
import { DeploymentsProvider } from './context/DeploymentsContext';
import { GenerationProvider } from './context/GenerationContext';
import { NotificationProvider } from './context/NotificationContext';
import { SourcesSidebarProvider } from './context/SourcesSidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserConfigProvider } from './context/UserConfigContext';
import './i18n/config';
import './styles.scss';

const LoginPage = lazy(() => import('./pages/auth/Login'));

/* Override the CDN fallback set by @epam/pdf-highlighter-kit at module-load time. */
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/*
 * SCRATCH — local-only markdown design preview, not part of the app.
 * Visit `?markdownPreview` to view. Delete this block and the
 * `MessageRole`/`AssistantMessageBubble` imports above when done; never
 * commit.
 */
const MARKDOWN_PREVIEW_SAMPLE = `# Heading 1
## Heading 2
### Heading 3

Some **bold text**, some *italic text*, and some ~~strikethrough~~.

- Unordered item one
- Unordered item two
  - Nested item

1. Ordered item one
2. Ordered item two

- [x] Completed task
- [ ] Pending task

> A blockquote with a bit of extra context.

Here is some \`inline code\` in a sentence.

\`\`\`ts
// A comment explaining the function below
export const greet = (name: string): string => {
  const times = 3;
  const url = "https://example.com/very/long/query/path?token=abcdefghijklmnopqrstuvwxyz0123456789&session=abcdefghijklmnopqrstuvwxyz0123456789";
  return \`Hello, \${name}! (\${times})\`;
};
\`\`\`

\`\`\`markdown
# A markdown heading

Some **bold text** and some *italic text* with \`inline code\` and a [link](https://example.com).

- List item one
- List item two
\`\`\`

| Model | Provider | Context |
| --- | --- | --- |
| GPT-4o | OpenAI | 128k |
| Claude | Anthropic | 200k |

Check the [DIAL docs](https://example.com) for more.

---

End of sample.
`;

/*
 * SCRATCH — local-only attachment-restyle design preview, not part of the
 * app. Visit `?attachmentsPreview` (add `&dark` to fake dark-theme CSS vars,
 * since ThemeProvider needs a live backend to resolve them). Delete this
 * block and the related imports above when done; never commit.
 */
const svgPlaceholder = (label: string, bg: string, fg = 'fff'): string =>
  `https://placehold.co/400x400/${bg.replace('#', '')}/${fg}?text=${encodeURIComponent(label)}`;

let nextId = 0;
const makeImage = (label: string, color: string): DisplayAttachment => ({
  id: `img-${nextId++}`,
  name: `${label}.png`,
  contentType: 'image/png',
  type: AttachmentType.Image,
  status: RequestStatus.Idle,
  previewUrl: svgPlaceholder(label, color),
});

const makeFile = (name: string, contentType: string): DisplayAttachment => ({
  id: `file-${nextId++}`,
  name,
  contentType,
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: '#',
});

const IMAGE_COLORS = [
  '#124ACE',
  '#7E39EC',
  '#007274',
  '#7F6300',
  '#AE2F2F',
  '#37BABC',
  '#2764D9',
];

const singleImage = [makeImage('photo-1', IMAGE_COLORS[0])];
const gridImages = IMAGE_COLORS.slice(0, 3).map((c, i) =>
  makeImage(`photo-${i + 1}`, c),
);
const manyImages = IMAGE_COLORS.map((c, i) => makeImage(`photo-${i + 1}`, c));

const singleFile = [makeFile('quarterly-report.pdf', 'application/pdf')];
const multiFiles = [
  makeFile('quarterly-report.pdf', 'application/pdf'),
  makeFile('budget.xlsx', 'application/vnd.ms-excel'),
  makeFile('proposal.docx', 'application/msword'),
  makeFile('script.ts', 'application/typescript'),
  makeFile('archive.zip', 'application/zip'),
  makeFile('mystery.xyz', 'application/octet-stream'),
];

const mixedGroup = [
  ...gridImages.slice(0, 2),
  makeFile('quarterly-report.pdf', 'application/pdf'),
  makeFile('budget.xlsx', 'application/vnd.ms-excel'),
];

const fileStates: DisplayAttachment[] = [
  {
    id: `file-${nextId++}`,
    name: 'uploading-video.mp4',
    contentType: 'video/mp4',
    type: AttachmentType.File,
    status: RequestStatus.Loading,
  },
  {
    id: `file-${nextId++}`,
    name: 'failed-network.pdf',
    contentType: 'application/pdf',
    type: AttachmentType.File,
    status: RequestStatus.Error,
    errorReason: AttachmentErrorReason.Network,
  },
  {
    id: `file-${nextId++}`,
    name: 'failed-unsupported.exe',
    contentType: 'application/octet-stream',
    type: AttachmentType.File,
    status: RequestStatus.Error,
    errorReason: AttachmentErrorReason.UnsupportedType,
  },
  makeFile(
    'this-is-a-very-long-filename-that-should-truncate-with-an-ellipsis-eventually.docx',
    'application/msword',
  ),
];

const previewActions = {
  role: MessageRole.User,
  onCopy: () => undefined,
  onCopyMarkdown: () => undefined,
};

const AttachmentPreviewSection = ({
  title,
  attachments,
}: {
  title: string;
  attachments: DisplayAttachment[];
}) => (
  <div className="mb-8">
    <div className="dial-small-semi-text mb-2 text-secondary">{title}</div>
    <UserMessageBubble
      text=""
      attachments={attachments}
      actions={previewActions}
      onAttachmentClick={() => undefined}
      onAttachmentRetry={() => undefined}
      getAttachmentSizeLabel={() => '2.4 MB'}
      attachmentTheme={isFakeDark ? CodeBlockTheme.Dark : CodeBlockTheme.Light}
    />
  </div>
);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

const isMarkdownPreview = new URLSearchParams(window.location.search).has(
  'markdownPreview',
);
const isAttachmentsPreview = new URLSearchParams(window.location.search).has(
  'attachmentsPreview',
);
const isFakeDark = new URLSearchParams(window.location.search).has('dark');

/*
 * Without a live backend, ThemeProvider never fetches `/api/themes`, so none
 * of these CSS custom properties get set — every component falls back to
 * its SCSS-level literal fallback, which (matching the CodeBlock precedent)
 * is the DARK hex, not light. So light mode needs an explicit override here
 * too, not just dark — otherwise this preview always renders dark rules
 * regardless of the requested mode.
 */
const FAKE_THEME_VARS = {
  light: {
    '--bg-layer-2': '#EEF1F7',
    '--bg-layer-3': '#FCFCFC',
    '--text-primary': '#161B2D',
    '--text-secondary': '#575F73',
    '--stroke-secondary': '#D1DBEA',
    '--bg-error': '#F3D6D8',
    '--text-error': '#AE2F2F',
    '--bg-success': '#D9F0F1',
    '--text-success': '#007274',
    '--bg-info': '#D6E2F9',
    '--text-info': '#124ACE',
    '--bg-accent-tertiary-alpha': '#A972FF2E',
    '--text-accent-tertiary': '#7E39EC',
    '--bg-warning': '#FAF0CF',
    '--text-warning': '#7F6300',
    '--bg-accent-primary': '#2764D9',
    '--bg-accent-primary-alpha': '#7DA4FF2E',
  },
  dark: {
    '--bg-layer-2': '#161B2D',
    '--bg-layer-3': '#1D2439',
    '--text-primary': '#EEF1F7',
    '--text-secondary': '#9FA6BD',
    '--stroke-secondary': '#242C42',
    '--bg-error': '#402027',
    '--text-error': '#F76464',
    '--bg-success': '#1D3841',
    '--text-success': '#37BABC',
    '--bg-info': '#1C2C47',
    '--text-info': '#7DA4FF',
    '--bg-accent-tertiary-alpha': '#A972FF2E',
    '--text-accent-tertiary': '#A972FF',
    '--bg-warning': '#3F3D25',
    '--text-warning': '#EEC840',
    '--bg-accent-primary': '#5C8DEA',
    '--bg-accent-primary-alpha': '#7DA4FF26',
  },
};

if (isAttachmentsPreview) {
  const themeVars = FAKE_THEME_VARS[isFakeDark ? 'dark' : 'light'];
  const htmlEl = document.documentElement;
  Object.entries(themeVars).forEach(([k, v]) => htmlEl.style.setProperty(k, v));

  root.render(
    <StrictMode>
      <div
        className="dial-body-text mx-auto max-w-3xl p-8 text-primary"
        style={{ backgroundColor: isFakeDark ? '#0c101d' : '#fcfcfc' }}
      >
        <AttachmentPreviewSection title="1 image" attachments={singleImage} />
        <AttachmentPreviewSection
          title="2-4 images (grid)"
          attachments={gridImages}
        />
        <AttachmentPreviewSection
          title="5+ images (collapsed +N)"
          attachments={manyImages}
        />
        <AttachmentPreviewSection
          title="Single file"
          attachments={singleFile}
        />
        <AttachmentPreviewSection
          title="Multiple files (each type)"
          attachments={multiFiles}
        />
        <AttachmentPreviewSection
          title="Mixed group"
          attachments={mixedGroup}
        />
        <AttachmentPreviewSection
          title="File states: uploading / failed / long name"
          attachments={fileStates}
        />
      </div>
    </StrictMode>,
  );
} else if (isMarkdownPreview) {
  root.render(
    <StrictMode>
      <div className="dial-body-text mx-auto max-w-3xl p-8 text-primary">
        <AssistantMessageBubble
          text={MARKDOWN_PREVIEW_SAMPLE}
          deploymentDisplayName="GPT-4o"
          hasAlwaysVisibleActions
          actions={{
            role: MessageRole.Assistant,
            onCopy: () => undefined,
            onCopyMarkdown: () => undefined,
            onRegenerate: () => undefined,
            onLike: () => undefined,
            onDislike: () => undefined,
          }}
        />
      </div>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <BrowserRouter>
          <NotificationProvider>
            <NotificationContainer />
            <UserProvider>
              <ThemeProvider>
                <AppConfigProvider>
                  <SourcesSidebarProvider>
                    <AttachmentCanvasProvider>
                      <Suspense fallback={null}>
                        <Routes>
                          <Route path="/login" element={<LoginPage />} />
                          <Route
                            path="*"
                            element={
                              <RequireAuth>
                                <GenerationProvider>
                                  <UserConfigProvider>
                                    <DeploymentsProvider>
                                      <ConversationsProvider>
                                        <App />
                                      </ConversationsProvider>
                                    </DeploymentsProvider>
                                  </UserConfigProvider>
                                </GenerationProvider>
                              </RequireAuth>
                            }
                          />
                        </Routes>
                      </Suspense>
                    </AttachmentCanvasProvider>
                  </SourcesSidebarProvider>
                </AppConfigProvider>
              </ThemeProvider>
            </UserProvider>
          </NotificationProvider>
        </BrowserRouter>
      </RootErrorBoundary>
    </StrictMode>,
  );
}
