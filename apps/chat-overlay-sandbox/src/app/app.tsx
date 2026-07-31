import { FC, memo, ReactNode, useState } from 'react';
import AuthUiModeCase from '../cases/AuthUiModeCase/AuthUiModeCase';
import ConversationListCase from '../cases/ConversationListCase/ConversationListCase';
import DirectOverlayCase from '../cases/DirectOverlayCase/DirectOverlayCase';
import EnabledFeaturesCase from '../cases/EnabledFeaturesCase/EnabledFeaturesCase';
import ManagerOverlayCase from '../cases/ManagerOverlayCase/ManagerOverlayCase';

enum SandboxCase {
  Direct = 'direct',
  Manager = 'manager',
  ConversationList = 'conversation-list',
  EnabledFeatures = 'enabled-features',
  AuthUiMode = 'auth-ui-mode',
}

interface SandboxCaseDetails {
  id: SandboxCase;
  title: string;
  description: string;
}

const SANDBOX_CASES: SandboxCaseDetails[] = [
  {
    id: SandboxCase.Direct,
    title: 'Direct ChatOverlay case',
    description:
      'Mount a single overlay and exercise its core methods and lifecycle events.',
  },
  {
    id: SandboxCase.Manager,
    title: 'ChatOverlayManager case',
    description:
      'Try the floating manager, visibility controls, positioning, and fullscreen.',
  },
  {
    id: SandboxCase.ConversationList,
    title: 'Conversation-list methods case',
    description:
      'Explore conversation listing, selection, creation, renaming, and deletion.',
  },
  {
    id: SandboxCase.EnabledFeatures,
    title: 'enabledFeatures case',
    description:
      'Apply feature presets or a custom feature set to the overlay at runtime.',
  },
  {
    id: SandboxCase.AuthUiMode,
    title: 'Provider auth UI mode case',
    description:
      'Configure external or same-window authentication for individual providers.',
  },
];

/** Case index/landing page listing only the v1-scoped `chat-overlay` sandbox cases. */
const App: FC = () => {
  const [activeCase, setActiveCase] = useState<SandboxCase | null>(null);

  const renderCasePage = (content: ReactNode) => (
    <main className="sandbox-case-page">
      <button
        className="sandbox-back-button"
        type="button"
        onClick={() => setActiveCase(null)}
      >
        Back to case list
      </button>
      {content}
    </main>
  );

  if (activeCase === SandboxCase.Direct) {
    return renderCasePage(<DirectOverlayCase />);
  }

  if (activeCase === SandboxCase.Manager) {
    return renderCasePage(<ManagerOverlayCase />);
  }

  if (activeCase === SandboxCase.ConversationList) {
    return renderCasePage(<ConversationListCase />);
  }

  if (activeCase === SandboxCase.EnabledFeatures) {
    return renderCasePage(<EnabledFeaturesCase />);
  }

  if (activeCase === SandboxCase.AuthUiMode) {
    return renderCasePage(<AuthUiModeCase />);
  }

  return (
    <main className="sandbox-home">
      <header className="sandbox-home__hero">
        <span className="sandbox-home__eyebrow">Developer playground</span>
        <h1>Chat Overlay Sandbox</h1>
        <p>
          Choose a focused scenario to explore and verify the overlay API in
          isolation.
        </p>
      </header>

      <section aria-labelledby="sandbox-cases-heading">
        <div className="sandbox-home__section-heading">
          <h2 id="sandbox-cases-heading">Available cases</h2>
          <span>{SANDBOX_CASES.length} scenarios</span>
        </div>

        <ul className="sandbox-case-grid">
          {SANDBOX_CASES.map(({ id, title, description }, index) => {
            const titleId = `sandbox-case-${id}-title`;

            return (
              <li key={id}>
                <button
                  className="sandbox-case-card"
                  type="button"
                  aria-labelledby={titleId}
                  onClick={() => setActiveCase(id)}
                >
                  <span className="sandbox-case-card__number" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="sandbox-case-card__content">
                    <span className="sandbox-case-card__title" id={titleId}>
                      {title}
                    </span>
                    <span className="sandbox-case-card__description">
                      {description}
                    </span>
                    <span className="sandbox-case-card__action" aria-hidden>
                      Open case
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
};

export default memo(App);
