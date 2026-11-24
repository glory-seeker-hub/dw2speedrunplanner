# Fantasmic random attack element

## Confirmed behavior

Fantasmic Bomb (`0xF1`, 241) and Fantasmic Ray (`0xF4`, 244) choose one random attack element per successful execution: Water, Fire, Nature, Machine, or Darkness. The selection is stored in `action.effectiveElement` before impacts and participates in normal specialty and floor/tile damage calculation. Every target in that execution shares the selection; a later use draws again.

The existing `fantasmic-element` RNG category and successful-hit draw position are retained. Missed or skipped actions do not draw an element. This remains a normal battle RNG draw under Natural RNG, seeded simulation, Optimized Search rollouts, and TAS Luck; no new TAS opportunity or gate is introduced. The effect audit records `Random attack element: <element>`, and impacts expose the effective element.

## Existing representation

Canonical WAZADATA byte4 remains nonstandard (`0x36`) and decodes to `element === null` for both techniques. Raw data and the decoder are unchanged. Null is preserved rather than inventing a fixed element or treating the technique as Neutral.

`src/utils/battleSkillSemantics.ts` defines `RANDOM_ELEMENT_SKILL_IDS` and `isRandomElementSkillId`, recognizing exactly `0xF1` and `0xF4`. Compatibility projection, Planner analysis, validation, battle support assessment, and execution share this definition. The legacy `Tech` representation uses a `None` placeholder; the execution-time effective element supplies the real damage element. Other unresolved elements remain fail-closed. The existing self-check still requires the nonstandard byte4 IDs to be exactly `[241,244]`.

## Bug corrected

Fantasmic Ray already had production random-element execution support, but Fantasmic Bomb did not. Compatibility and Analyze Battle exempted only `0xF4`, so GAIA1 encounter 151 could not be imported through Analyze Battle. Both IDs now use one shared mechanic, without a GAIA-specific navigation exception.

Regression coverage records Chaos Tower / after Blood Knights / Floor 20 battles through the Planner recording API and builds analysis presets for GAIA1 (151) and GAIA2 (152). Canonical stats and techniques are retained, including Titan Laser / Fantasmic Bomb / GAIA Gear for GAIA1 and Fantasmic Ray for GAIA2, without synthetic fallback. Deterministic engine tests cover every element for both techniques, production damage comparison, shared multi-target impacts, repeated execution, miss behavior, and effect audit output.
