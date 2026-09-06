# Contributing to Rabi Raster

Thanks for taking an interest in Rabi Raster. The public contribution policy is still being prepared alongside the project license. For now, use this guide to make and verify a local change, and confirm the current contribution route before opening a pull request.

## Local setup

Rabi Raster requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

The editor runs at [http://127.0.0.1:5199](http://127.0.0.1:5199).

## Before proposing a change

- Keep image processing and export local to the browser.
- Preserve existing DialKit paths, the settings JSON schema, and browser storage keys unless the change includes a documented migration.
- Keep generators, renderers, motion, palette, and output settings independently editable.
- Use plain, specific English for interface copy. Buttons should describe the action they perform, and disabled actions should explain the next step.
- Do not add source photographs, logos, fonts, or reference artwork without clear permission to distribute them.
- Update documentation when a capability, limitation, default, or browser requirement changes.

## Verify the change

Run the normal checks:

```sh
npm test
npm run build
```

For changes that affect the editor flow, canvas output, storage, or export, install Chromium once and run the browser suite:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite starts Vite on port 5199 in headless Chromium. The quality benchmark under `scripts/benchmarks/` regenerates example media and is intentionally separate from normal verification.

Include a short description of the user-facing behavior, the checks you ran, and any browser or codec limitation that remains.

## License status

The original project code does not have a selected license yet. Dependency licenses do not apply to Rabi Raster itself. Public contributions and redistribution terms will be clarified when the project license is chosen.


## Regenerate the visual guide

Edit `src/app/choice-catalog.ts` to keep menu and gallery descriptions in sync. The SVG examples are generated from the same renderer settings. From the repository root:

```sh
./node_modules/.bin/rolldown scripts/generate-choice-guide.ts --platform node --format esm --file node_modules/.cache/rabi-raster-guide.mjs
node node_modules/.cache/rabi-raster-guide.mjs
```

Review `docs/gallery/choice-guide.md` and its generated SVG files before including them in a change. The gallery is documentation only and is not loaded by the editor.
