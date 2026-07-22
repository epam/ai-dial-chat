import { FC, memo, useState } from 'react';
import DirectOverlayCase from '../cases/DirectOverlayCase/DirectOverlayCase';
import ManagerOverlayCase from '../cases/ManagerOverlayCase/ManagerOverlayCase';

enum SandboxCase {
  Direct = 'direct',
  Manager = 'manager',
}

/** Case index/landing page listing only the v1-scoped `chat-overlay` sandbox cases. */
const App: FC = () => {
  const [activeCase, setActiveCase] = useState<SandboxCase | null>(null);

  if (activeCase === SandboxCase.Direct) {
    return (
      <div>
        <button type="button" onClick={() => setActiveCase(null)}>
          ← Back to case list
        </button>
        <DirectOverlayCase />
      </div>
    );
  }

  if (activeCase === SandboxCase.Manager) {
    return (
      <div>
        <button type="button" onClick={() => setActiveCase(null)}>
          ← Back to case list
        </button>
        <ManagerOverlayCase />
      </div>
    );
  }

  return (
    <div>
      <h1>@epam/ai-dial-chat-overlay sandbox</h1>
      <ul>
        <li>
          <button
            type="button"
            onClick={() => setActiveCase(SandboxCase.Direct)}
          >
            Direct ChatOverlay case
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={() => setActiveCase(SandboxCase.Manager)}
          >
            ChatOverlayManager case
          </button>
        </li>
      </ul>
    </div>
  );
};

export default memo(App);
