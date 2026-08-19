import { memo, type FC } from 'react';
import { useFeatureFlag } from '../../../context/AppConfigContext';
import { useUsageData } from '../../../hooks/useUsageData';

/*
 * Empty container for now — useUsageData already fetches and stores the data
 * so a follow-up task can render it without any structural change here.
 */
const UsageTab: FC = () => {
  const isSettingsPageEnabled = useFeatureFlag('settingsPageEnabled');
  useUsageData(isSettingsPageEnabled);

  return (
    <div className="flex size-full min-h-0 flex-col">
      <span role="status" aria-live="polite" className="sr-only" />
    </div>
  );
};

export default memo(UsageTab);
