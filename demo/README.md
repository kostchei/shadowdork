# Shadowdork demos

This directory contains generated visual-development artifacts that are useful
for review but are not part of the shipped game runtime.

## Contents

- `biome-samples/` — fixed-seed 960×540 captures for all 18 visual skins, plus
  a labeled HTML gallery and contact sheet.

## Conventions

- Give each experiment its own self-contained subdirectory.
- Include an `index.html` when the result benefits from side-by-side review.
- Keep source captures deterministic and record the seed and resolution.
- Use numbered filenames when ordering matters in a contact sheet.
- Keep temporary or failed captures out of this directory.

When the Vite development server is running, open `/demo/` to browse the demo
index or `/demo/biome-samples/` to open the biome gallery directly.
