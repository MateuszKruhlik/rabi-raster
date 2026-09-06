import { useEffect, useRef } from 'react';

import { renderRasterFrame } from '../raster/render';
import type { RasterSettings } from '../raster/settings';

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 88;
const PREVIEW_FOREGROUND = '#d5d5dc';
const PREVIEW_DENSITY_SCALE = .45;

interface StylePreviewProps {
  settings: RasterSettings;
}

function stableSettingsSignature(settings: RasterSettings) {
  return JSON.stringify(
    Object.entries(settings).sort(([first], [second]) => first.localeCompare(second)),
  );
}

export function StylePreview({ settings }: StylePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsSignature = stableSettingsSignature(settings);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;

    const markScale = settings.mode === 'matrix'
      ? Math.min(1.5, settings.markScale * 1.35)
      : settings.mode === 'particles'
        ? Math.min(1.5, settings.markScale * 1.9)
        : settings.markScale;

    const previewSettings: RasterSettings = {
      ...settings,
      // Presets are compared against one repeatable generated field. A selected
      // local image is never read or retained by these decorative thumbnails.
      source: 'organic',
      seed: 583,
      patternScale: 1.25,
      columns: Math.max(40, Math.round(settings.columns * PREVIEW_DENSITY_SCALE)),
      markScale,
      foreground: PREVIEW_FOREGROUND,
      accentColor: PREVIEW_FOREGROUND,
      accentColor2: PREVIEW_FOREGROUND,
      accentAmount: 0,
      motion: 'off',
      amplitude: 0,
      fade: 'none',
      edgeSensitivity: .9,
    };

    context.imageSmoothingEnabled = false;
    renderRasterFrame(context, {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      phase: 0,
      settings: previewSettings,
      source: null,
    });
  }, [settingsSignature]);

  return (
    <canvas
      aria-hidden="true"
      height={PREVIEW_HEIGHT}
      ref={canvasRef}
      width={PREVIEW_WIDTH}
    />
  );
}
