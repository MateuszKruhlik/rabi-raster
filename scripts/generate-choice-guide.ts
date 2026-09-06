import { mkdir, writeFile } from 'node:fs/promises';
import { PATTERN_OPTIONS, RENDERER_OPTIONS } from '../src/app/choice-catalog';
import { exportSvg } from '../src/export/svg';

const directory = 'docs/gallery/choices';
await mkdir(directory, { recursive: true });
const lines = [
  '# Pattern and renderer guide',
  '',
  'Choose a pattern to create the source, then a renderer to decide how it is drawn. Imported photos can use every renderer too.',
  '',
  'These are static frames from the actual renderer. Pattern examples share one drawing treatment; renderer examples share the same generated Organic Field. Motion is off so the differences are easy to compare. No source photograph is used.',
  '',
];
for (const [section, entries] of [['Patterns', PATTERN_OPTIONS], ['Renderers', RENDERER_OPTIONS]] as const) {
  lines.push(`## ${section}`, '', '| Preview | Choice | What it does |', '| --- | --- | --- |');
  for (const entry of entries) {
    if (!entry.preview) {
      lines.push(`| Your local file | ${entry.label} | ${entry.description} |`);
      continue;
    }
    const filename = `${section.toLowerCase()}-${entry.value}.svg`;
    const exported = await exportSvg({ width: 480, height: 264, settings: entry.preview, phase: 0, background: '#141416', transparent: false });
    await writeFile(`${directory}/${filename}`, await exported.blob.text());
    lines.push(`| <img src="choices/${filename}" width="200" alt="${entry.label} example"> | **${entry.label}** | ${entry.description} |`);
  }
  lines.push('');
}
lines.push('## Where to start', '',
  '- **Website background:** Organic Field or Ribbon, then Dither or Halftone. Reserve text space and use gentle motion.',
  '- **Photo treatment:** Choose Image and compare Halftone with Dot Matrix. Adjust contrast before density.',
  '- **Crisp silhouette:** Try Contour Particles with a clean source; it detects edges rather than removing a background.',
  '- **Typographic artwork:** Choose ASCII and edit the built-in Glyphs ramp if needed.',
  '',
  'The editor generates small previews only while a menu is open. This gallery is separate from the editor bundle. To try these choices, [run the editor](../../README.md#quick-start).',
  '');
await writeFile('docs/gallery/choice-guide.md', lines.join('\n'));
console.log('Generated 13 SVG examples and docs/gallery/choice-guide.md.');
