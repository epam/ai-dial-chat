import { getEnabledFeatures } from '../../utils/common';
import { DropdownSelector, DropdownSelectorOption } from './DropdownSelector';

import { ChatOverlayManagerOptions, Feature } from '@epam/ai-dial-overlay';
import { useCallback, useState } from 'react';
import { MultiValue } from 'react-select';

interface FeaturesSelectorProps {
  enabledFeatures: string | Feature[] | undefined;
  setOptions: (newOptions: Partial<ChatOverlayManagerOptions>) => void;
}

export function FeaturesSelector({
  enabledFeatures,
  setOptions,
}: FeaturesSelectorProps) {
  const allOverlayFeatures = Object.entries(Feature).map(([label, value]) => ({
    label,
    value,
  }));
  const overlayEnabledFeaturesValues = getEnabledFeatures(enabledFeatures);
  const overlayEnabledFeatures = allOverlayFeatures.filter(({ value }) =>
    overlayEnabledFeaturesValues.includes(value),
  );

  const [selectedOverlayFeatures, setSelectedOverlayFeatures] = useState<
    DropdownSelectorOption[]
  >(overlayEnabledFeatures);

  const handleOnChangeSelectedFeature = useCallback(
    (features: MultiValue<DropdownSelectorOption>) => {
      setSelectedOverlayFeatures(features as DropdownSelectorOption[]);
    },
    [],
  );

  const handleSetFeatures = useCallback(() => {
    const newFeatures = selectedOverlayFeatures.map(({ value }) => value);
    setOptions({ enabledFeatures: newFeatures as Feature[] });
  }, [selectedOverlayFeatures, setOptions]);

  return (
    <div className="pt-8">
      <DropdownSelector
        value={selectedOverlayFeatures}
        options={allOverlayFeatures}
        onChange={handleOnChangeSelectedFeature}
        isSearchable
        isMulti
        isClearable
        menuPlacement={'auto'}
        placeholder="Select features"
        id="features-dropdown"
      />

      <button className="button w-full" onClick={handleSetFeatures}>
        Set features
      </button>
    </div>
  );
}
