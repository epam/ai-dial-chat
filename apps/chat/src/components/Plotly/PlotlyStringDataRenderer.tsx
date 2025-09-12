import React from 'react';
import { PlotParams } from 'react-plotly.js';

import { PlotlyComponent } from './Plotly';

interface Props {
  plotlyStringData: string;
}

export function PlotlyStringDataRenderer({ plotlyStringData }: Props) {
  const plotlyData = useMemo(
    () => JSON.parse(plotlyStringData) as PlotParams,
    [plotlyStringData],
  );

  return <PlotlyComponent plotlyData={plotlyData} />;
}
