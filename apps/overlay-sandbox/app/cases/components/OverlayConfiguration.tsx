import { parseJsonOptionsString } from '../../utils/common';
import { FeaturesSelector } from './FeaturesSelector';

import { ChatOverlayManagerOptions, Feature } from '@epam/ai-dial-overlay';
import { useCallback, useState } from 'react';

interface Props {
  //options without the Features
  restOverlayOptions: Partial<ChatOverlayManagerOptions>;
  handleSetOverlayOptions: (
    newOptions: Partial<ChatOverlayManagerOptions>,
  ) => void;
}

export function ConfigurationInJSON({
  restOverlayOptions,
  handleSetOverlayOptions,
}: Props) {
  const [overlayConfigJson, setOverlayConfigJson] = useState(
    JSON.stringify(restOverlayOptions).replaceAll(',', ',\n'),
  );
  const [overlayConfig, setOverlayConfig] =
    useState<Partial<ChatOverlayManagerOptions>>();

  const [overlayConfigJsonError, setOverlayConfigJsonError] = useState(false);

  const handleSetOptions = useCallback(() => {
    if (overlayConfig) {
      handleSetOverlayOptions(overlayConfig);
    }
  }, [handleSetOverlayOptions, overlayConfig]);

  return (
    <details>
      <summary className="font-bold">Overlay configuration JSON</summary>
      {overlayConfigJsonError && (
        <div className="text-red-500">
          Invalid JSON string. Please check you input
        </div>
      )}
      <textarea
        className="h-96 w-full border"
        placeholder="Type Overlay configuration JSON"
        value={overlayConfigJson}
        onChange={(e) => {
          setOverlayConfigJson(e.target.value);

          const newParsedOptions = parseJsonOptionsString(e.target.value);
          if (newParsedOptions === null) {
            setOverlayConfigJsonError(true);
            return;
          }
          setOverlayConfig(newParsedOptions);
          setOverlayConfigJsonError(false);
        }}
      />
      <button
        className="button w-full"
        onClick={handleSetOptions}
        data-qa="set-configuration-in-json"
      >
        Set Options JSON
      </button>
    </details>
  );
}

interface OverlayFeaturesProps {
  enabledFeatures: string | Feature[] | undefined;
  setOverlayOptions: (newOptions: Partial<ChatOverlayManagerOptions>) => void;
}
export function OverlayFeatures({
  enabledFeatures,
  setOverlayOptions,
}: OverlayFeaturesProps) {
  return (
    <details open className="mt-3">
      <summary className="font-bold">Overlay Features</summary>
      <FeaturesSelector
        enabledFeatures={enabledFeatures}
        setOptions={setOverlayOptions}
      />
    </details>
  );
}
