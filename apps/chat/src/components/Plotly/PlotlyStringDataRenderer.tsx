import React, { useMemo } from 'react';
import { PlotParams } from 'react-plotly.js';

import { PlotlyComponent } from './Plotly';

interface Props {
  plotlyStringData: string;
  isFullScreen?: boolean;
}

export function PlotlyStringDataRenderer({
  plotlyStringData,
  isFullScreen,
}: Props) {
  const plotlyData = useMemo(
    () => JSON.parse(plotlyStringData) as PlotParams,
    [plotlyStringData],
  );

  return (
    <PlotlyComponent plotlyData={plotlyData} isFullScreen={isFullScreen} />
  );
}
