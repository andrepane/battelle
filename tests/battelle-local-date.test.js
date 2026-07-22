import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('todayIso usa calendario local y createAssessment conserva timestamps UTC', () => {
  const code = `
    import { todayIso, createAssessment } from './src/battelle-state.js';
    const instant = new Date('2026-07-22T02:30:00.000Z');
    const assessment = createAssessment(instant);
    console.log(JSON.stringify({
      today: todayIso(instant),
      utcDay: instant.toISOString().slice(0, 10),
      assessmentDate: assessment.assessmentDate,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt
    }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.today, '2026-07-21');
  assert.equal(output.utcDay, '2026-07-22');
  assert.equal(output.assessmentDate, '2026-07-21');
  assert.match(output.createdAt, /^2026-07-22T02:30:00\.000Z$/);
  assert.equal(output.updatedAt, output.createdAt);
});
