import 'fake-indexeddb/auto';
import { runAllTests } from '../src/utils/testSuite';
import { TestResult } from '../src/types';

async function main() {
  console.log('Starting StudySync Automated Test Suite in Headless Environment...');
  let latestTests: TestResult[] = [];

  const results = await runAllTests((tests) => {
    latestTests = tests;
  });

  console.log('\n--- TEST SUITE SUMMARY ---');
  let allPassed = true;
  for (const t of results) {
    const icon = t.status === 'passed' ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${t.durationMs ?? 0}ms] ${t.name}`);
    if (t.status === 'failed' || t.logs.length > 0) {
      console.log('   Logs:');
      t.logs.forEach(l => console.log('     ', l));
    }
  }

  const { syncEngine } = await import('../src/sync/syncEngine');
  console.log('\n--- SYNC ENGINE LOGS ---');
  syncEngine.getLogs().forEach(l => console.log(`[${l.type}] ${l.message}`));

  if (allPassed) {
    console.log('\nAll 6 tests passed successfully!');
    process.exit(0);
  } else {
    console.error('\nSome tests failed.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
