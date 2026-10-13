# Low Rally Constitution

## Core Principles

### I. Mobile-First, Installable PWA
Every feature MUST work on a touch phone in portrait and landscape before it is considered done.
Touch input MUST be a first-class source, not a fallback. The production build MUST remain an
installable, offline-capable PWA served as a static site that works from any sub-path
(relative asset paths or an explicit `BASE_PATH`).
Rationale: the game's audience and distribution model is "open a link on a phone, add to home screen".

### II. Everything Generated in Code
The game MUST ship with no external art, model, audio or font assets. Car, scenery, icons and sound
MUST be generated procedurally from code, and all colours MUST come from the palette in
`src/config.ts`. Any new asset need MUST be met with a generator (as with `scripts/make-icons.mjs`)
rather than a binary file.
Rationale: keeps the repository tiny, the look coherent, and the build reproducible.

### III. Performance Budget Is a Feature (NON-NEGOTIABLE)
The target is a smooth 60 fps on mid-range phones. The per-frame game loop MUST NOT allocate;
geometry and instance buffers MUST be pooled and rewritten in place; real-time shadows and
per-frame DOM writes outside the throttled HUD path are prohibited. Pixel ratio MUST stay capped.
Changes that add per-frame cost MUST state and justify it in the plan.
Rationale: a rally game that stutters on a phone has failed its only job.

### IV. Deterministic, Single-Source-of-Truth World
Procedural content (track, terrain, props) MUST be seeded and deterministic. There MUST be one
authoritative query for each world fact (e.g. `Terrain.heightAt`, the track's nearest-road-point
query); the car, camera, meshes and props MUST all use it rather than re-deriving the answer.
Simulation MUST run on a fixed timestep with render-side interpolation.
Rationale: visuals, physics and scenery stay consistent and reproducible across devices and refresh rates.

### V. Simple Arcade Model, Tuned Not Simulated
Handling MUST be an arcade model with all tuning constants centralised in `src/config.ts`; no
physics engine or heavyweight dependency may be introduced without a justified amendment-level
exception. New features MUST be the smallest thing that delivers the experience (YAGNI); items
listed under "Next steps (deliberately not built)" in the README need a spec before work starts.
Rationale: feel is achieved by tuning, and every dependency costs bundle size on mobile.

### VI. Design Patterns for Recurring Problems
Solutions to recurring design problems MUST follow the catalogue in *Design Patterns: Elements of
Reusable Object-Oriented Software* (Gamma, Helm, Johnson, Vlissides). Before writing bespoke
structure, the author MUST check whether a creational, structural or behavioral pattern fits, and
the plan MUST name the pattern used (e.g. Factory Method or Object Pool for creation, Adapter or
Facade for structure, Strategy, Observer or State for behavior). Patterns MUST be applied to a real
problem, not speculatively, and MUST be adapted to idiomatic TypeScript (interfaces, composition,
closures) rather than ported literally. The performance budget (Principle III) always wins: where a
pattern would add per-frame allocation, indirection or other cost on the hot path, the pattern MUST
be dropped or adapted. Every pattern considered and discarded MUST be documented in an
Architecture Design Review entry in the plan, stating the pattern, the problem it was weighed
against, and why it was rejected (e.g. the specific performance, bundle-size or simplicity cost).
A conflict with Principle V (simplicity) is resolved the same way and MUST be recorded likewise.
Rationale: shared, well-known vocabulary keeps the design legible and the code easy to extend, and
recording rejected patterns stops the same trade-off being relitigated later.

## Technical Constraints

- Stack: TypeScript (strict, `tsc --noEmit` clean), Vite, Three.js, `vite-plugin-pwa`.
- Runtime dependencies MUST be minimal; adding one requires justification in the plan
  (bundle size, offline precache impact).
- Input sources MUST implement the shared `InputState`/`InputSource` interface so new devices plug
  in without touching the car controller.
- Persistent state is limited to `localStorage` and MUST degrade gracefully when unavailable.
- Debug hooks (e.g. `window.__game`) MUST be stripped from production builds.
- Audio MUST start only after a user gesture (iOS Safari requirement).

## Development Workflow

- `npm run build` (type-check plus production build) MUST pass before merge.
- Changes touching handling, rendering or world generation MUST be verified by running the game
  (`npm run dev`) and, for input or layout changes, on a touch viewport.
- PWA-affecting changes MUST be checked against a production build served over `localhost` or HTTPS.
- Non-obvious behaviour (handling model, chunking, terrain blending) MUST be documented in place
  and in the README's "How it works" section when it changes.
- Features go through the Spec Kit flow: specify, plan, tasks, implement.
- Each plan MUST include an Architecture Design Review entry listing the patterns adopted and any
  pattern considered but discarded, with the reason (Principle VI).

## Governance

This constitution supersedes other practices. Plans and reviews MUST check compliance with the
principles above, and any deviation MUST be recorded and justified in the plan's complexity notes.
Amendments are made by editing this file in a commit that explains the change, updating dependent
docs (README, templates) in the same change where affected. Versioning follows semantic versioning:
MAJOR for removing or redefining a principle, MINOR for adding a principle or materially expanding
guidance, PATCH for clarifications. Use `README.md` for runtime development guidance.

**Version**: 1.2.0 | **Ratified**: 2026-10-13 | **Last Amended**: 2026-10-13
