import { memo, useEffect, useRef, useState } from 'react';
import { PlotParams } from 'react-plotly.js';

import dynamic from 'next/dynamic';

import isEqual from 'lodash-es/isEqual';
import { Layout, PlotRelayoutEvent } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Props {
  plotlyData: PlotParams;
}

export const PlotlyComponent = memo(
  ({ plotlyData: { layout, ...data } }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [currentLayout, setCurrentLayout] = useState<Partial<Layout>>(layout);

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      setWidth(containerRef.current.scrollWidth);
    }, []);

    const handleRelayout = (newLayout: PlotRelayoutEvent) => {
      // save layout if changed
      setCurrentLayout({ ...currentLayout, ...newLayout });
    };

    return (
      <div ref={containerRef} className="size-full">
        <Plot
          {...data}
          layout={{ ...currentLayout, width }}
          onRelayout={handleRelayout}
        />
      </div>
    );
  },
  (prevProps, nextProps) => isEqual(prevProps, nextProps),
);
PlotlyComponent.displayName = 'PlotlyComponent';
