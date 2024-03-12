import React, { memo } from 'react';

import dynamic from 'next/dynamic';

import isEqual from 'lodash-es/isEqual';
import { Layout, PlotData } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Props {
  plotlyData: { data: Partial<PlotData>[]; layout: Partial<Layout> };
}

const PlotlyComponent = memo(
  ({ plotlyData: { data, layout } }: Props) => {
    return <Plot data={data} layout={layout} />;
  },
  (prevProps, nextProps) => isEqual(prevProps, nextProps),
);
PlotlyComponent.displayName = 'PlotlyComponentTemplate';

export default PlotlyComponent;
