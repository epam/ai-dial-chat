import { NeutralButton } from '@epam/ai-dial-ui-kit';
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
    <main className="mx-auto w-full max-w-[1120px] px-5 py-8 desktop:px-8 desktop:py-16">
      <NeutralButton
        className="mb-5 min-h-11"
        type="button"
        label="Back to case list"
        onClick={() => setActiveCase(null)}
      />
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
    <main className="mx-auto w-full max-w-[1120px] px-5 py-8 desktop:px-8 desktop:py-16">
      <header className="mb-10 max-w-[720px] desktop:mb-14">
        <span className="inline-flex min-h-[30px] items-center rounded-full border border-accent-alpha bg-info px-[11px] py-1 text-xs font-bold uppercase tracking-[0.08em] text-info">
          Developer playground
        </span>
        <h1 className="mb-3 mt-[18px] text-[clamp(2rem,7vw,3.5rem)] leading-[1.05] tracking-[-0.04em]">
          Chat Overlay Sandbox
        </h1>
        <p className="m-0 max-w-[620px] text-[clamp(1rem,3vw,1.125rem)] leading-[1.65] text-secondary">
          Choose a focused scenario to explore and verify the overlay API in
          isolation.
        </p>
      </header>

      <section aria-labelledby="sandbox-cases-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-lg" id="sandbox-cases-heading">
            Available cases
          </h2>
          <span className="text-sm text-secondary">
            {SANDBOX_CASES.length} scenarios
          </span>
        </div>

        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 desktop:grid-cols-2 desktop:gap-[18px]">
          {SANDBOX_CASES.map(({ id, title, description }, index) => {
            const titleId = `sandbox-case-${id}-title`;

            return (
              <li key={id}>
                <NeutralButton
                  className="focus-visible:outline-offset-3 h-auto min-h-[180px] w-full items-stretch rounded-2xl border border-secondary bg-layer-raised px-5 py-5 text-start text-primary shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-info hover:shadow-md focus-visible:outline focus-visible:outline-2"
                  textClassName="w-full"
                  type="button"
                  aria-labelledby={titleId}
                  onClick={() => setActiveCase(id)}
                  label={
                    <span className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-4">
                      <span
                        className="grid size-9 place-items-center rounded-[10px] bg-info text-xs font-extrabold text-info"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="text-[1.05rem] font-bold leading-[1.35]"
                          id={titleId}
                        >
                          {title}
                        </span>
                        <span className="mt-2 whitespace-normal leading-[1.55] text-secondary">
                          {description}
                        </span>
                        <span
                          className="mt-auto pt-[18px] text-sm font-bold text-accent"
                          aria-hidden
                        >
                          Open case
                        </span>
                      </span>
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
};

export default memo(App);
