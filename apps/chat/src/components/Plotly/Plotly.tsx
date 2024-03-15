import { memo, useEffect, useRef, useState } from 'react';
import { PlotParams } from 'react-plotly.js';

import dynamic from 'next/dynamic';

import isEqual from 'lodash-es/isEqual';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Props {
  plotlyData: PlotParams;
}

export const PlotlyComponent = memo(
  ({ plotlyData: { layout, ...data } }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      setWidth(containerRef.current.scrollWidth);
      setHeight(containerRef.current.scrollHeight);
    }, []);

    return (
      <div ref={containerRef} className="size-full">
        <Plot
          useResizeHandler
          {...data}
          layout={{ ...layout, width, height }}
        />
      </div>
    );
  },
  (prevProps, nextProps) => isEqual(prevProps, nextProps),
);
PlotlyComponent.displayName = 'PlotlyComponentTemplate';
