import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PlotParams } from 'react-plotly.js';

import dynamic from 'next/dynamic';

import isEqual from 'lodash-es/isEqual';
import { Layout, PlotRelayoutEvent } from 'plotly.js';

const DEFAULT_HEIGHT = 450;

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Props {
  plotlyData: PlotParams;
  isFullScreen?: boolean;
}

export const PlotlyComponent = memo(
  ({ plotlyData: { layout, ...data }, isFullScreen }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [width, setWidth] = useState<number | undefined>(undefined);
    const [height, setHeight] = useState<number | undefined>(undefined);
    const [currentLayout, setCurrentLayout] = useState<Partial<Layout>>(layout);

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      setWidth(containerRef.current.clientWidth);
      setHeight(
        isFullScreen
          ? containerRef.current.clientHeight
          : (currentLayout.height ?? DEFAULT_HEIGHT),
      );
    }, [currentLayout.height, isFullScreen]);

    const handleRelayout = useCallback((newLayout: PlotRelayoutEvent) => {
      // save layout if changed
      setCurrentLayout((prevLayout) => ({ ...prevLayout, ...newLayout }));
    }, []);

    return (
      <div ref={containerRef} className="size-full">
        <Plot
          {...data}
          layout={{ ...currentLayout, width, height }}
          onRelayout={handleRelayout}
        />
      </div>
    );
  },
  (prevProps, nextProps) => isEqual(prevProps, nextProps),
);
PlotlyComponent.displayName = 'PlotlyComponent';
