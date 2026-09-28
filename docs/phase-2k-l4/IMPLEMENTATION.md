# Phase 2K-L4 implementation and audit

**Final report:** [FINAL-REPORT.md](FINAL-REPORT.md). The following notes describe the original audit, before the architectural course correction; the final policy supersedes the restart-first implementation decision below. The correction audit is in [COURSE-CORRECTION-AUDIT.md](COURSE-CORRECTION-AUDIT.md).

## Pre-implementation audit

Baseline: f705977, merge of committed L3 921e52a. Existing L4 branch starts at that baseline; working tree initially clean.

The generator in battleOptimizedSearch finishes at maxDepth, when no parents remain, or when no complete decision-state screening fits. Budget is an upper bound; refinement is 4 -> 16 -> 64 and finite. Root initialization requires rootPlanInfo.minimumBudget = root plan count * 4. Later stages reserve complete batches before execution. There is no reason to pad unused budget.

Randomness: rolloutSeed(master, depth, parent prefix, sample index) is the existing paired fair-world schedule. replayPlayerPrefix creates the seeded battle RNG; random continuation orders, enemy orders, targets, accuracy, statuses and unsupported Natural RNG under TAS all consume that stream. Root motivation uses a deterministic derived seed. Enumeration and beam ranking are deterministic, and representativeSample currently chooses an objective-specific observed continuation. TAS conflict exploration is bounded and deterministic, with unsupported outcomes staying Natural. There is no independent random candidate sampler today.

Implementation decision: keep the entire paired fair-world schedule and first pass unchanged. Later exploration identities select different observed continuation samples and order expansion parents using a separate deterministic seed. This changes the explored decision states without changing candidate statistics or the objective comparator. Root legal plans remain common. A terminal/deterministic battle may naturally yield identical results across passes. No additional battle RNG implementation is needed.

Pass-local state: generator, beam/frontier, candidate stages and samples, completed paths, paired seed cache, counters, diagnostics and accumulators. Global: immutable input/configuration, root minimum, total budget/used count, bounded cross-pass winners, global observed fastest, pass counts, elapsed time and cancellation (worker-owned). Orchestration belongs in the search layer inside the same worker.

Reports already have extensible configuration/searchSummary objects. Add optional structured fields, keep reportVersion 1. Simulator controls are ephemeral React state; no Planner schema/storage changes.
