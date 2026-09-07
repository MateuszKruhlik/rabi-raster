import { useDialKitController } from 'dialkit';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  downloadBlob,
  exportImage,
  exportVideo,
  getVideoExportCapabilities,
  type VideoExportCapabilities,
} from './export';
import {
  OUTPUT_SIZES,
  RASTER_PRESETS,
  createSettingsDocument,
  getOutputSize,
  parseSettingsDocument,
  rasterDialConfig,
  toRasterSettings,
  type OutputSizeId,
  type RasterDialValues,
  type VideoFormat,
} from './app/config';
import { exportSvg } from './export/svg';
import { decodeLocalImage, type DecodedImage } from './app/media';
import { StylePreview } from './app/StylePreview';
import { DEFAULT_RASTER_SETTINGS, type RasterSettings } from './raster/settings';
import { RasterControls } from './app/RasterControls';
import { RasterCanvas } from './app/RasterCanvas';
import { createVariation, type VariationKind } from './app/variation';
import type { RasterDialUpdates } from './app/config';
import { useLoopClock } from './app/use-loop-clock';

const APP_BASE_URL = (import.meta as ImportMeta & {
  readonly env: { readonly BASE_URL: string };
}).env.BASE_URL;

const STYLE_PREVIEWS = RASTER_PRESETS.map(preset => ({
  ...DEFAULT_RASTER_SETTINGS,
  mode: (preset.values.Effect?.Renderer ?? DEFAULT_RASTER_SETTINGS.mode) as RasterSettings['mode'],
  columns: preset.values.Effect?.Density ?? DEFAULT_RASTER_SETTINGS.columns,
  markScale: preset.values.Effect?.['Mark size'] ?? DEFAULT_RASTER_SETTINGS.markScale,
  contrast: preset.values.Effect?.Contrast ?? DEFAULT_RASTER_SETTINGS.contrast,
  invert: preset.values.Effect?.Invert ?? DEFAULT_RASTER_SETTINGS.invert,
  mark: (preset.values.Effect?.Mark ?? DEFAULT_RASTER_SETTINGS.mark) as RasterSettings['mark'],
  glyphs: preset.values.Effect?.Glyphs ?? DEFAULT_RASTER_SETTINGS.glyphs,
}));

const VARIATION_TARGETS = [
  { id: 'look', label: 'Look', hint: 'Changes density, mark size, and contrast. Halftone also changes shape.' },
  { id: 'motion', label: 'Motion', hint: 'Changes strength, direction, frequency, and variation. Movement and duration stay the same.' },
  { id: 'pattern', label: 'Pattern', hint: 'Changes the seed and scale of this generated pattern.' },
  { id: 'distribution', label: 'Points', hint: 'Changes point placement and irregularity.' },
  { id: 'colors', label: 'Accents', hint: 'Changes two accent colors, their amount, and distribution.' },
] as const;

const SETTINGS_STORAGE_KEY = 'rabi-raster:settings:v1';

type ExportState = Readonly<{
  kind: 'idle' | 'working' | 'success' | 'error';
  message: string;
  progress?: number;
}>;

const INITIAL_EXPORT_STATE: ExportState = {
  kind: 'idle',
  message: 'Ready for a local export.',
};

function formatTime(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function formatBytes(bytes: number) {
  return bytes < 1_000_000 ? `${(bytes / 1_000).toFixed(0)} kB` : `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M5.1 6.2A6 6 0 1 1 4 11M5.1 6.2V2.8m0 3.4H8.5" />
    </svg>
  );
}

function App() {
  const dial = useDialKitController('Rabi Raster', rasterDialConfig, {
    id: 'rabi-raster-controls',
    persist: false,
  });
  const values = dial.values as RasterDialValues;
  const settings = useMemo(() => toRasterSettings(values), [values]);
  const output = useMemo(() => getOutputSize(values), [values]);
  const logicalOutput = OUTPUT_SIZES[values.Output.Canvas as OutputSizeId] ?? OUTPUT_SIZES.wide;
  const clock = useLoopClock(values.Motion.Duration);
  const presetListRef = useRef<HTMLDivElement>(null);
  const [variationTarget, setVariationTarget] = useState<VariationKind>('look');
  const settingsInputRef = useRef<HTMLInputElement>(null);
  const videoAbortRef = useRef<AbortController | null>(null);
  const skipNextPersistRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [activePreset, setActivePreset] = useState('signal-noise');
  const [variationHistory, setVariationHistory] = useState<RasterDialUpdates[]>([]);
  const [decodedImage, setDecodedImage] = useState<DecodedImage | null>(null);
  const [imageStatus, setImageStatus] = useState('Procedural source. No file needed.');
  const [exportState, setExportState] = useState<ExportState>(INITIAL_EXPORT_STATE);
  const [videoCapabilities, setVideoCapabilities] = useState<VideoExportCapabilities | null>(null);

  useEffect(() => {
    let settleFrame = 0;
    const hydrateFrame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (saved) {
          skipNextPersistRef.current = true;
          dial.setValues(parseSettingsDocument(JSON.parse(saved)));
          setActivePreset('');
        }
      } catch {
        try { localStorage.removeItem(SETTINGS_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
      }
      settleFrame = requestAnimationFrame(() => setHydrated(true));
    });
    return () => {
      cancelAnimationFrame(hydrateFrame);
      if (settleFrame) cancelAnimationFrame(settleFrame);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(createSettingsDocument(values)),
      );
    } catch {
      // Private or quota-restricted browsers can keep the current session working.
    }
  }, [hydrated, values]);

  useEffect(() => {
    let active = true;
    if (!values.Source.Image) {
      setDecodedImage(null);
      setImageStatus(
        values.Source.Pattern === 'image'
          ? 'Choose a local image. Files are never uploaded or saved.'
          : 'Procedural source. No file needed.',
      );
      return () => { active = false; };
    }

    setImageStatus('Decoding image locally…');
    setDecodedImage(null);
    void decodeLocalImage(values.Source.Image)
      .then((decoded) => {
        if (!active) return;
        setDecodedImage(decoded);
        setImageStatus(decoded
          ? `${decoded.width} × ${decoded.height} image ready for this session.`
          : 'Choose a local image.');
        if (decoded && dial.getValues().Source.Pattern !== 'image') {
          dial.setValue('Source.Pattern', 'image');
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDecodedImage(null);
        setImageStatus(`Could not decode this image. ${errorMessage(error)}`);
      });
    return () => { active = false; };
  }, [values.Source.Image]);

  useEffect(() => {
    let active = true;
    setVideoCapabilities(null);
    void getVideoExportCapabilities({
      transparent: values.Output.Transparent, width: output.width, height: output.height,
    }).then((capabilities) => {
      if (active) setVideoCapabilities(capabilities);
    });
    return () => { active = false; };
  }, [values.Output.Transparent, output.width, output.height]);

  const source = settings.source === 'image' ? decodedImage?.data ?? null : null;
  const missingImage = settings.source === 'image' && !source;
  const sourceStatusMessage = settings.source !== 'image'
    ? 'Procedural source. No file needed.'
    : values.Source.Image
      ? imageStatus
      : 'Choose a local image. Files are never uploaded or saved.';
  const videoFormat = values.Output.Video as VideoFormat;
  const videoCapability = videoCapabilities?.[videoFormat];
  const exporting = exportState.kind === 'working';

  const target = VARIATION_TARGETS.find(item => item.id === variationTarget)!;
  const variationDisabledReason = exporting ? 'Wait for the export to finish.'
    : variationTarget === 'pattern' && settings.source === 'image' ? 'Choose a generated pattern to randomize it.'
    : variationTarget === 'distribution' && settings.mode !== 'particles' ? 'Choose Contour Particles to randomize points.'
    : variationTarget === 'motion' && settings.motion === 'off' ? 'Turn motion on to randomize it.'
    : missingImage ? `Choose a local image to randomize ${target.label.toLowerCase()}.` : '';

  const applyPreset = (presetId: string) => {
    const preset = RASTER_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    dial.setValues(preset.values);
    setActivePreset(preset.id);
    setVariationHistory([]);
    setExportState({ kind: 'idle', message: `${preset.name} style loaded. Image, palette and motion preserved.` });
  };

  const handleRandomize = (kind: VariationKind) => {
    if (variationDisabledReason) return;
    const variation = createVariation(dial.getValues() as RasterDialValues, kind, crypto.getRandomValues(new Uint32Array(4)));
    setVariationHistory(history => [...history.slice(-19), variation.undo]);
    dial.setValues(variation.updates);
    if (kind === 'look') setActivePreset('');
    setExportState({ kind: 'idle', message: `${target.label} randomized. Use Undo to restore the previous version.` });
  };

  const handleUndoVariation = () => {
    const previous = variationHistory.at(-1);
    if (!previous) return;
    dial.setValues(previous);
    setVariationHistory(history => history.slice(0, -1));
    setActivePreset('');
    setExportState({ kind: 'idle', message: 'Previous variation restored.' });
  };

  const handleReset = () => {
    videoAbortRef.current?.abort();
    setVariationHistory([]);
    dial.resetValues();
    dial.setValue('Source.Image', '');
    try { localStorage.removeItem(SETTINGS_STORAGE_KEY); } catch { /* Session reset still succeeds. */ }
    setDecodedImage(null);
    setActivePreset('signal-noise');
    clock.setPlaying(false);
    clock.restart();
    setExportState({ kind: 'idle', message: 'Editor reset to Organic Field and Signal Dither defaults.' });
  };

  const handleSaveSettings = () => {
    const document = createSettingsDocument(dial.getValues() as RasterDialValues);
    const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], {
      type: 'application/json',
    });
    downloadBlob(blob, 'rabi-raster-settings.json');
    setExportState({ kind: 'success', message: 'Settings JSON saved without image data.' });
  };

  const handleLoadSettings = async (file: File | undefined) => {
    if (!file) return;
    try {
      const updates = parseSettingsDocument(JSON.parse(await file.text()));
      setVariationHistory([]);
      dial.setValues(updates);
      dial.setValue('Source.Image', '');
      setDecodedImage(null);
      setActivePreset('');
      clock.restart();
      setExportState({
        kind: 'success',
        message: updates.Source?.Pattern === 'image'
          ? 'Settings loaded. Choose the local image again to restore the artwork.'
          : 'Settings loaded.',
      });
    } catch (error) {
      setExportState({ kind: 'error', message: errorMessage(error) });
    } finally {
      if (settingsInputRef.current) settingsInputRef.current.value = '';
    }
  };

  const handleExportImage = async () => {
    if (missingImage) {
      setExportState({ kind: 'error', message: 'Choose an image before exporting this source.' });
      return;
    }
    setExportState({ kind: 'working', message: 'Rendering PNG…', progress: 0.2 });
    try {
      const result = await exportImage({
        width: output.width,
        height: output.height,
        settings,
        source,
        phase: clock.phase,
        background: values.Output.Background,
        transparent: values.Output.Transparent,
        fileName: 'rabi-raster',
      });
      downloadBlob(result.blob, result.fileName);
      setExportState({
        kind: 'success',
        message: `${result.fileName} · ${result.width} × ${result.height} · ${formatBytes(result.blob.size)}`,
        progress: 1,
      });
    } catch (error) {
      setExportState({ kind: 'error', message: errorMessage(error) });
    }
  };

  const handleExportSvg = async () => {
    if (missingImage) return;
    setExportState({ kind: 'working', message: 'Rendering SVG…', progress: .2 });
    try {
      const result = await exportSvg({ width: output.width, height: output.height, settings, source,
        phase: clock.phase, background: values.Output.Background, transparent: values.Output.Transparent,
        fileName: 'rabi-raster' });
      downloadBlob(result.blob, result.fileName);
      setExportState({ kind: 'success', message: `${result.fileName} · ${formatBytes(result.blob.size)} · Editable vector frame. ASCII uses the viewer’s monospace font.`, progress: 1 });
    } catch (error) {
      setExportState({ kind: 'error', message: errorMessage(error) });
    }
  };

  const handleExportVideo = async () => {
    if (missingImage) {
      setExportState({ kind: 'error', message: 'Choose an image before exporting this source.' });
      return;
    }
    if (!videoCapability?.supported) {
      setExportState({
        kind: 'error',
        message: videoCapability?.reason ?? 'Checking video encoder support. Try again shortly.',
      });
      return;
    }

    const abortController = new AbortController();
    videoAbortRef.current = abortController;
    clock.setPlaying(false);
    setExportState({ kind: 'working', message: `Encoding ${videoFormat.toUpperCase()} loop…`, progress: 0 });
    try {
      const result = await exportVideo({
        width: output.width,
        height: output.height,
        settings,
        source,
        duration: values.Motion.Duration,
        background: values.Output.Background,
        format: videoFormat,
        transparent: values.Output.Transparent,
        frameRate: Number(values.Output['Frame rate']) as 24 | 30,
        quality: values.Output.Quality as 'web' | 'high',
        signal: abortController.signal,
        onProgress: (progress) => setExportState({
          kind: 'working',
          message: `Encoding ${videoFormat.toUpperCase()} loop…`,
          progress,
        }),
        fileName: 'rabi-raster-loop',
      });
      downloadBlob(result.blob, result.fileName);
      setExportState({
        kind: 'success',
        message: `${result.fileName} · ${result.frameCount} frames · ${result.duration.toFixed(1)}s · ${formatBytes(result.blob.size)}`,
        progress: 1,
      });
    } catch (error) {
      setExportState({
        kind: error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error',
        message: errorMessage(error),
      });
    } finally {
      videoAbortRef.current = null;
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Rabi Raster home">
          <img className="brand-mark" src={`${APP_BASE_URL}brand/mark.svg`} width="40" height="40" alt="" />
          <span>
            <strong>Rabi Raster</strong>
            <small>by Rabituza Studio</small>
          </span>
        </a>
        <div className="privacy-note">
          <span className="privacy-dot" aria-hidden="true" />
          Made locally. Stays local.
        </div>
      </header>

      <section className="workspace">
        <div className="stage-column">
          <div className="preset-strip" aria-label="Look presets">
            <div className="preset-heading">
              <span>Styles</span>
              <small>Change the texture. Keep your image and motion.</small>
              <div className="preset-navigation">
                <button className="icon-button" aria-label="Previous styles" onClick={() => presetListRef.current?.scrollBy({ left: -300 })} type="button">←</button>
                <button className="icon-button" aria-label="Next styles" onClick={() => presetListRef.current?.scrollBy({ left: 300 })} type="button">→</button>
              </div>
            </div>
            <div className="preset-list" ref={presetListRef}>
              {RASTER_PRESETS.map((preset, index) => (
                <button
                  aria-pressed={activePreset === preset.id && Object.entries(preset.values.Effect ?? {}).every(([key, value]) => values.Effect[key as keyof typeof values.Effect] === value)}
                  className="preset-card"
                  data-active={activePreset === preset.id && Object.entries(preset.values.Effect ?? {}).every(([key, value]) => values.Effect[key as keyof typeof values.Effect] === value) ? '' : undefined}
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  type="button"
                >
                  <span className="preset-swatch"><StylePreview settings={STYLE_PREVIEWS[index]} /></span>
                  <span>
                    <strong>{preset.name}</strong>
                    <small>{preset.note}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <section className="stage" aria-label="Artwork workspace">
            <div className="stage-meta">
              <div>
                <span className="eyebrow">Live output</span>
                <strong>{logicalOutput.label}</strong>
              </div>
              <div className="stage-meta-end">
                <span>{settings.mode}</span>
                <span>{values.Output.Resolution} export</span>
                <span className="live-indicator"><i aria-hidden="true" />{clock.playing ? 'Playing' : 'Paused'}</span>
              </div>
            </div>

            <div
              className="canvas-frame"
              data-transparent={values.Output.Transparent ? '' : undefined}
              style={{
                aspectRatio: `${logicalOutput.width} / ${logicalOutput.height}`,
                '--output-ratio': logicalOutput.width / logicalOutput.height,
              } as React.CSSProperties}
            >
              <RasterCanvas
                background={values.Output.Background}
                logicalHeight={logicalOutput.height}
                logicalWidth={logicalOutput.width}
                phase={clock.phase}
                settings={settings}
                source={source}
                transparent={values.Output.Transparent}
              />
              {missingImage && (
                <div className="canvas-empty" role="status">
                  <span>Image source selected</span>
                  <strong>Choose a local image in Source</strong>
                  <small>The file stays in this browser session.</small>
                </div>
              )}
            </div>

            <div className="transport" aria-label="Loop transport">
              <button
                aria-label={clock.playing ? 'Pause loop' : 'Play loop'}
                className="icon-button transport-play"
                onClick={clock.toggle}
                type="button"
              >
                {clock.playing ? <span aria-hidden="true">Ⅱ</span> : <span aria-hidden="true">▶</span>}
              </button>
              <button aria-label="Restart loop" className="icon-button" onClick={clock.restart} type="button">
                <RestartIcon />
              </button>
              <span className="timecode">{formatTime(clock.time)}</span>
              <input
                aria-label="Loop position"
                className="timeline-range"
                max={values.Motion.Duration}
                min="0"
                onChange={(event) => clock.setTime(Number(event.target.value))}
                onPointerDown={() => clock.setPlaying(false)}
                step="0.01"
                style={{ '--timeline-progress': `${clock.phase * 100}%` } as React.CSSProperties}
                type="range"
                value={clock.time}
              />
              <span className="timecode timecode-end">{formatTime(values.Motion.Duration)}</span>
              <span className="loop-chip">Loop</span>
            </div>
          </section>
        </div>

        <aside className="control-column" aria-label="Raster controls">
          <div className="control-scroll">
          <div className="control-heading">
            <div>
              <span className="eyebrow">Your workspace</span>
              <h1>Edit artwork</h1>
            </div>
            <button className="text-button" onClick={handleReset} type="button">Reset</button>
          </div>
          <div className="variation-actions">
            <div className="variation-heading"><span>Explore variations</span><button className="text-button" aria-label="Undo variation" title={variationHistory.length === 0 ? 'Nothing to undo yet.' : 'Restore the last variation'} onClick={handleUndoVariation} disabled={exporting || variationHistory.length === 0} type="button">↶ Undo</button></div>
            <div className="variation-row">
              <label className="variation-target">Target
                <select aria-label="Target" value={variationTarget} onChange={event => setVariationTarget(event.target.value as VariationKind)} aria-describedby="variation-hint">
                  {VARIATION_TARGETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <button className="secondary-button" onClick={() => handleRandomize(variationTarget)} disabled={!!variationDisabledReason} aria-describedby="variation-hint" type="button">Randomize {target.label.toLowerCase()}</button>
            </div>
            <small id="variation-hint" aria-live="polite">{variationDisabledReason || target.hint}</small>
          </div>
          <div className="dialkit-host">
            <RasterControls />
          </div>
          <p className="control-note">{settings.mode === 'particles' ? 'Points follow detected edges. Open Particles to tune sensitivity and spacing irregularity. A clean silhouette gives clearer contours.' : settings.mode === 'matrix' ? 'Dot Matrix keeps dot size fixed. Tone selects opacity or brightness; Cutoff removes faint dots.' : 'Density sets the grid; Mark size sets thickness. Tone and Cutoff apply to Dot Matrix.'} Open Palette and increase Accent amount to add color. {settings.source === 'ribbon' ? 'Open Source → Ribbon for count, width and twist.' : 'Source seed and scale affect generators only.'}</p>
          <p className="source-status" data-kind={missingImage ? 'warning' : 'ready'}>
            <span aria-hidden="true" />{sourceStatusMessage}
          </p>

            <div className="recipe-actions">
            <div className="settings-actions">
              <button className="secondary-button" onClick={handleSaveSettings} type="button">Save settings</button>
              <button className="secondary-button" onClick={() => settingsInputRef.current?.click()} type="button">Load settings</button>
              <input
                accept="application/json,.json"
                aria-label="Load settings JSON"
                className="visually-hidden"
                onChange={(event) => void handleLoadSettings(event.target.files?.[0])}
                ref={settingsInputRef}
                type="file"
              />
            </div>
            </div>
          </div>
          <section className="output-actions" aria-label="Settings and export">


            <div className="export-grid">
              <button className="secondary-button export-button" disabled={exporting || missingImage}
                onClick={() => void handleExportSvg()} type="button"><DownloadIcon /> Export SVG</button>
              <button
                className="secondary-button export-button"
                disabled={exporting || missingImage}
                onClick={() => void handleExportImage()}
                type="button"
              >
                <DownloadIcon /> Export PNG
              </button>
              <button
                className="primary-button export-button"
                disabled={exporting || missingImage || videoCapability?.supported !== true}
                onClick={() => void handleExportVideo()}
                title={videoCapability?.supported === false ? videoCapability.reason : undefined}
                type="button"
              >
                <DownloadIcon /> Export loop
              </button>
            </div>
            <details className="export-details"><summary>Export details · {output.width} × {output.height}</summary>
            <p className="export-note">
              {output.width} × {output.height} · {values.Output['Frame rate']} fps · {values.Output.Quality === 'web' ? 'Compact web quality' : 'High detail'}.
              {' '}{values.Output.Transparent
                ? 'Transparent SVG, PNG + WebM. MP4 needs a solid background. Check Safari playback; keep a PNG fallback.'
                : 'SVG, PNG and video include the background. Turn Transparent on for an overlay.'}
              {' '}Use 0.5× for smaller backgrounds; 1× keeps fine marks sharper. File size appears after export.
            </p>
            </details>
            {videoCapability?.supported === false && (
              <p className="video-capability" role="note">
                {videoFormat.toUpperCase()} unavailable: {videoCapability.reason}
              </p>
            )}

            {exporting && videoAbortRef.current && (
              <button className="cancel-button" onClick={() => videoAbortRef.current?.abort()} type="button">
                Cancel export
              </button>
            )}
            <div className="export-status" data-kind={exportState.kind} role="status" aria-live="polite">
              <div>
                <span>{exportState.message}</span>
                {exportState.progress !== undefined && <strong>{Math.round(exportState.progress * 100)}%</strong>}
              </div>
              {exportState.progress !== undefined && (
                <progress max="1" value={exportState.progress} aria-label="Export progress" />
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
