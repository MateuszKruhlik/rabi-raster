# Rabi Raster UI review and implementation

2026-09-06. Leading specialty: Rabituza UI Review. Supporting specialty: Design Foundations (layout and iconography). Microcopy reviewed through the UX writing expert; see [writing decisions](ux-writing.md).

## Review decision

The previous editor needed changes to visual identity, style selection and variation hierarchy. The implemented revision is ready for local use and user review. This is an expert review with browser checks, not evidence from a usability study.

| Before | After | Why |
| --- | --- | --- |
| Gradient letter R badge | Monochrome mark derived from Organic Field and ordered dither | Connect the identity to the actual output of the product |
| Same decorative symbol for all styles | Eight static previews rendered from a repeatable field | Show differences between dots, contours, ASCII and other treatments |
| Hidden horizontal scroll | Visible scrollbar plus previous/next controls | Make the remaining styles discoverable |
| Six competing variation buttons | Target selector, one named randomize action, Undo | Clarify the scope of each experiment |
| Generic explanation of disabled actions | Target-specific reason and next step | Explain when an image, renderer or movement is required |
| Selected style stayed highlighted after edits | Selection is checked against current effect values | Avoid claiming that a modified effect still matches the preset |
| Export below every control | Separate export area on desktop | Keep the main output action reachable |
| Dense always-visible format guidance | Expandable export details | Retain important information while giving editing more room |
| Small transport controls | 44 px transport buttons and timeline hit area | Improve pointer and touch handling |
| Local image lab / Shape the signal / Dense Pills | by Rabituza Studio / Edit artwork / Rounded Dots | Use clearer attribution, an explicit task heading and a visual style name |

## Boundaries

Pattern and Renderer now use product-owned visual menus through the public DialKit store and control APIs. Other dropdowns remain DialKit controls. Existing settings keys, JSON compatibility, image handling, render algorithms and export encoders are preserved. A target randomizes only its existing fields; it does not choose an entirely different renderer or movement. Source images remain outside saved JSON.

The sidebar still includes advanced controls grouped by function. Further conditional visibility would require a separate controller change; this revision does not hide inactive options through fragile DOM selectors.

The repository includes a real editor screenshot, a gallery entry point, contribution instructions and a CI workflow. Example mockups and a public project license remain separate decisions. GitHub CI has not been run until a remote repository exists.
