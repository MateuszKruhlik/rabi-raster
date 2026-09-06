import { memo, useSyncExternalStore } from 'react';
import { ControlRenderer, DialStore, Folder, type ControlMeta, type DialValue } from 'dialkit';
import { VisualChoice } from './VisualChoice';
import { PATTERN_OPTIONS, RENDERER_OPTIONS } from './choice-catalog';

const PANEL_ID = 'rabi-raster-controls';
const subscribePanels = (notify: () => void) => DialStore.subscribeGlobal(notify);
const getPanels = () => DialStore.getPanels();
const subscribeValues = (notify: () => void) => DialStore.subscribe(PANEL_ID, notify);
const getValues = () => DialStore.getValues(PANEL_ID);

function ControlGroup({ control, values }: { control: ControlMeta; values: Record<string, DialValue> }) {
  const path = control.path === 'Source' ? 'Source.Pattern' : control.path === 'Effect' ? 'Effect.Renderer' : null;
  if (!path) return <ControlRenderer panelId={PANEL_ID} controls={[control]} values={values} />;
  const label = path === 'Source.Pattern' ? 'Pattern' : 'Renderer';
  return (
    <Folder title={control.label} defaultOpen={control.defaultOpen ?? true}>
      <VisualChoice label={label} value={String(values[path])}
        onChange={value => DialStore.updateValue(PANEL_ID, path, value)}
        options={label === 'Pattern' ? PATTERN_OPTIONS : RENDERER_OPTIONS} />
      <ControlRenderer panelId={PANEL_ID} controls={(control.children ?? []).filter(child => child.path !== path)} values={values} />
    </Folder>
  );
}

/** Keep DialKit's store and controls; customize only the two visual choices. */
export const RasterControls = memo(function RasterControls() {
  const panels = useSyncExternalStore(subscribePanels, getPanels, getPanels);
  const values = useSyncExternalStore(subscribeValues, getValues, getValues);
  const panel = panels.find(entry => entry.id === PANEL_ID);
  if (!panel) return null;
  return (
    <div className="dialkit-root" data-mode="inline" data-theme="dark">
      <div className="dialkit-panel" data-mode="inline">
        <Folder title="Rabi Raster" isRoot inline>
          {panel.controls.map(control => <ControlGroup key={control.path} control={control} values={values} />)}
        </Folder>
      </div>
    </div>
  );
});
