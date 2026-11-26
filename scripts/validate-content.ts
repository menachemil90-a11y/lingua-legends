/* Validates the public content bank and the server-only ranked pool. */
import { RAW_ITEMS, RAW_PASSAGES, validateContent } from '../packages/content/src/index';
import { RANKED_RAW_ITEMS } from '../apps/server/src/content/rankedPool';

const pub = validateContent(RAW_ITEMS, RAW_PASSAGES);
// The ranked pool is small and does not have to meet the public minimum targets.
const ranked = validateContent(RANKED_RAW_ITEMS, RAW_PASSAGES, { references: false, targets: false });
const rankedIssues = ranked.issues;

const publicIds = new Set(RAW_ITEMS.map((i) => i.id));
const overlap = RANKED_RAW_ITEMS.filter((i) => publicIds.has(i.id)).map((i) => i.id);

let errors = 0;
for (const [label, issues] of [['public', pub.issues], ['ranked', rankedIssues]] as const) {
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    console.log(`[${label}] ${i.severity.toUpperCase()} ${i.ref}: ${i.message}`);
  }
}
for (const id of overlap) {
  errors++;
  console.log(`[ranked] ERROR ${id}: ranked item id also exists in the public bank`);
}
console.log('Public content stats:', pub.stats);
console.log('Ranked pool size:', RANKED_RAW_ITEMS.length);
if (errors > 0) {
  console.error(`Content validation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log('Content validation passed.');
