# TFB design system in Portfolio Atlas

The React desk uses **The Fintech Builder Open Core 03.1 Living Atlas** (edition 2026-09-10). This folder is the only place where the system's values enter the application.

## Declared context

| Decision       | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| Medium         | Responsive web application, left-to-right, English                                     |
| Audience       | Learners building and operating a portfolio desk                                       |
| Default        | Standard density, system light/dark theme                                              |
| Breakpoints    | Desktop ≥1200 px, tablet 768–1199 px, mobile ≤767 px; the rail becomes a menu ≤1024 px |
| Type floors    | 16 px body and inputs, 14 px short metadata, 44 px interaction targets                 |
| Print (report) | 11 pt body, 9.5 pt metadata                                                            |

## Files

| File                        | Role                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `tokens.json`               | Copy of the atlas token registry: palette, spacing, type, density, themes, motion                             |
| `tokens.css`                | Generated CSS variables. Run `npm run design:tokens`; `npm run check` fails when stale                        |
| `base.css`                  | Element defaults: type, focus, controls, buttons, tables, reduced motion                                      |
| `brand/open-core-*.svg`     | Official Open Core 01 marks, byte-identical to the registry                                                   |
| `BrandMark.tsx`, `theme.ts` | Mark component and per-viewer theme preference                                                                |
| `../app/styles.css`         | Shell (WEB-APF-01, WEB-GNV-08) and shared primitives                                                          |
| `../app/chapter.css`        | Chapter patterns: panels, forms, alerts (WEB-ALT), metrics (WEB-MET), tables (WEB-TBL), chart roles (WEB-CHR) |

Registry mark hashes (SHA-256): primary `605edc37…2413c6`, reversed `1bb16889…a11d99`, mono `bb3238e1…c80200`.

## Rules for new screens

1. Use tokens (`var(--surface)`, `var(--space-4)`, …). Never add a hex colour in a feature file.
2. Filled actions use `button.primary` (Accessible Magenta with white labels). Vivid Magenta is reserved for signal accents and the mark.
3. Status uses the semantic pairs `--positive/--positive-bg`, `--warning/--warning-bg` and `--danger/--danger-bg`, always with text, never colour alone.
4. Charts use role classes (`chart-series`, `chart-accent`, `chart-positive`, `chart-negative`, `chart-grid`). SVG labels keep the 14 px floor; narrow screens scroll a chart instead of shrinking it.
5. Numbers are tabular and right-aligned where they are compared (`.num`).
6. Wide tables live in `.chapter-table-wrap` and scroll inside their own region.
7. Do not shrink text to fit. Shorten, wrap, stack or paginate.

The deep-navy rail keeps the reversed mark in both themes. The theme selector stores only a display preference in browser storage.

## Scope of verification

Browser journeys run at desktop and 390 px widths. The audit script checks page overflow, the 14 px floor, 44 px targets and control labels in light and dark themes. These checks do not replace assistive-technology testing or a full accessibility audit.
