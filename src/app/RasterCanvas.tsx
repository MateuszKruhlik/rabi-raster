import { useEffect, useRef, useState } from 'react';

import { renderRasterFrame } from '../raster/render';
import type { RasterSettings } from '../raster/settings';

interface RasterCanvasProps {
  background: string;
  logicalHeight: number;
  logicalWidth: number;
  phase: number;
  settings: RasterSettings;
  source: ImageData | null;
  transparent: boolean;
}

export function RasterCanvas({
  background,
  logicalHeight,
  logicalWidth,
  phase,
  settings,
  source,
  transparent,
}: RasterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backing, setBacking] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(entry.contentRect.width * ratio));
      const height = Math.max(1, Math.round(entry.contentRect.height * ratio));
      setBacking((current) => current.width === width && current.height === height
        ? current
        : { width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    context.setTransform(
      backing.width / logicalWidth,
      0,
      0,
      backing.height / logicalHeight,
      0,
      0,
    );

    renderRasterFrame(context, {
      width: logicalWidth,
      height: logicalHeight,
      phase,
      settings,
      source,
    });

    if (!transparent) {
      context.save();
      context.globalCompositeOperation = 'destination-over';
      context.globalAlpha = 1;
      context.fillStyle = background;
      context.fillRect(0, 0, logicalWidth, logicalHeight);
      context.fillStyle = '#000000';
      context.fillRect(0, 0, logicalWidth, logicalHeight);
      context.restore();
    }
  }, [background, backing, logicalHeight, logicalWidth, phase, settings, source, transparent]);

  return (
    <canvas
      aria-label="Raster artwork preview"
      data-logical-height={logicalHeight}
      data-logical-width={logicalWidth}
      data-phase={phase.toFixed(4)}
      data-source-ready={String(settings.source !== 'image' || Boolean(source))}
      ref={canvasRef}
    />
  );
}
