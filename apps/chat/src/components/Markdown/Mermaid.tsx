import { memo, useEffect, useRef, useState } from 'react';

import mermaid from 'mermaid';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

interface Props {
    value: string;
}

export const Mermaid = memo(({ value }: Props) => {
    const theme = useAppSelector(UISelectors.selectThemeState);
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!value) return;
            try {
                setError(null);

                mermaid.initialize({
                    startOnLoad: false,
                    theme: theme === 'dark' ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                    themeVariables: {
                        primaryColor: theme === 'dark' ? '#3B3B4D' : '#F3F4F6',
                        primaryTextColor: theme === 'dark' ? '#E1E1E1' : '#111827',
                        primaryBorderColor: theme === 'dark' ? '#52526B' : '#D1D5DB',
                        lineColor: theme === 'dark' ? '#808090' : '#6B7280',
                        secondaryColor: theme === 'dark' ? '#2D2D3D' : '#E5E7EB',
                        tertiaryColor: theme === 'dark' ? '#1F1F2E' : '#FFFFFF',
                        mainBkg: theme === 'dark' ? '#2D2D3D' : '#F9FAFB',
                        nodeBorder: theme === 'dark' ? '#52526B' : '#D1D5DB',
                        clusterBkg: theme === 'dark' ? '#1F1F2E' : '#F3F4F6',
                        clusterBorder: theme === 'dark' ? '#3B3B4D' : '#E5E7EB',
                        defaultLinkColor: theme === 'dark' ? '#808090' : '#6B7280',
                        titleColor: theme === 'dark' ? '#FFFFFF' : '#111827',
                        edgeLabelBackground: theme === 'dark' ? '#1F1F2E' : '#FFFFFF',
                    },
                });

                const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
                const { svg: renderedSvg } = await mermaid.render(id, value);
                setSvg(renderedSvg);
            } catch (err) {
                console.error('Mermaid render error:', err);
                setError('Failed to render Mermaid diagram');
            }
        };

        renderDiagram();
    }, [value, theme]);

    if (error) {
        return (
            <div className="p-4 text-error">
                <p>{error}</p>
                <pre className="mt-2 text-xs overflow-auto">{value}</pre>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="mermaid-container flex justify-center overflow-auto bg-layer-2 p-6 transition-all"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
});

Mermaid.displayName = 'Mermaid';
