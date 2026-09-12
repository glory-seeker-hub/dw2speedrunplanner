// Reproducible report and self-checks. No workbook dependency at runtime.
const fs = require('node:fs');
const { load } = require('../tests/helpers/loadTs.cjs');
const { runBattleSkillSelfChecks, getBattleSkillCoverageReport } = load('src/utils/battleSkillValidation.ts');
const report = JSON.stringify(getBattleSkillCoverageReport(), null, 2) + '\n';
const output = 'docs/phase-2k-b/coverage.json';
if (process.argv.includes('--write-report')) fs.writeFileSync(output, report);
else if (fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== report) throw new Error('Coverage drift: regenerate and review coverage.json');
const checks = runBattleSkillSelfChecks();
for (const check of checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ': ' + check.detail : ''}`);
if (checks.some(c => !c.passed)) process.exitCode = 1;
