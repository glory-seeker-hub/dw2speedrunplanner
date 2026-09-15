// Synthetic histories through the production recorder; no browser storage access.
const fs = require('node:fs');
const path = require('node:path');
const { route, load } = require('../tests/helpers/plannerAnalysisFixtures.cjs');
const { isValidPersistedRunPlannerData, getRunPlannerSerializedBytes } = load('src/utils/runPlannerStorage.ts');
const starters = ['gold-hawk', 'blue-falcon', 'black-sword'];
const runs = Array.from({ length: 5 }, (_, index) => ({
  ...route(20, starters[index % starters.length]),
  name: `Representative route ${index + 1}`,
}));
const samples = [1, 3, 5].map(count => {
  const envelope = { schemaVersion: 7, runs: runs.slice(0, count), activeRunId: runs[count - 1].id };
  const valid = isValidPersistedRunPlannerData(envelope);
  if (!valid) throw new Error(`Invalid ${count}-run characterization envelope`);
  return {
    runs: count,
    eventsPerRun: envelope.runs.map(run => run.history.length),
    totalEvents: envelope.runs.reduce((sum, run) => sum + run.history.length, 0),
    serializedUtf8Bytes: getRunPlannerSerializedBytes(envelope),
    valid,
  };
});
const report = {
  schemaVersion: 7,
  methodology: 'Twenty synthetic recorded battles per route, with production rewards, progression and undo checkpoints; starters cycle Gold Hawk, Blue Falcon, Black Sword. Insertion-order envelopes activate their last run.',
  limitation: 'UTF-8 JSON serialization only. This does not measure browser localStorage quota, encoding overhead, capacity or write latency. No compression or event payload changes.',
  samples,
};
const output = path.resolve(__dirname, '../docs/phase-2k-j/storage-characterization.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
