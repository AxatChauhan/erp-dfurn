---
trigger:
  glob: "src/app/**"
---

# UI Design & Owner Mandates Rules (DFurn ERP)

1. **Strict 5-Color Palette**:
   - Orange: `#FF7700` (`var(--color-orange)` / `bg-orange-500`) for primary CTAs, links, focus rings, brand mark.
   - Black: `#000000` (`var(--color-black)`) for **ACTIVE/SELECTED** states in chips, toggles, and tabs. Never use Orange as the selected background.
   - Graphite: `#333333` (`var(--color-graphite)`) for text and dark borders.
   - Moonshell / Cream: `#F4F3ED` / `#F5F6F8` for backgrounds and card surfaces.
   - White: `#FFFFFF` for modal and card bodies.
   - Tri-state status colors: **Green (Done/Active) · Orange (In-Progress/Attention) · Red (Error/Hold/Lost)**. Never invent a fourth status color.

2. **No "Them" Dashes ("Em Dashes" / Unnecessary Hyphens) Rule**:
   - The owner explicitly mandated: *"please remove them dashes, whole app, and a rule for the future."*
   - Never use "them" dashes (`—`) in any user-facing text, placeholders, tooltips, or toast notifications.
   - For empty / null values, use an en dash `–`.
   - For value separation, use a dot `·` (e.g. `DF/C/B2B/00001 · India`).

3. **Dimensions Representation**:
   - Always format dimensions as `L 1400 × B 700 × H 750 mm`.
   - In form labels and table headers, the second dimension is always `B` (Breadth/Depth), never `W`.

4. **Component Ergonomics**:
   - Multi-field creation flows must use milestone stepper wizards (`wizard-modal`). Never build single long scrolling forms.
   - Short fixed choices (e.g. B2B / B2C, Yes / No) must be horizontal pill buttons, not `<select>` dropdowns.
   - Standing help text must live behind an info popover (`UI.info` or hover tooltip), not paragraphs on screen.
   - Names lead in bold; codes (`DF/C/...`) sit faint beneath them.
   - Every data-mutating action must show a loading state/overlay to prevent duplicate clicks.
