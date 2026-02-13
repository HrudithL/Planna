#!/usr/bin/env node
/**
 * Split the large SQL file into executable batches
 */
import fs from 'fs';

const sqlContent = fs.readFileSync('./scripts/import-all.sql', 'utf8');
const statements = sqlContent.split(';\n').filter(s => s.trim().length > 0);

console.log(`Total SQL statements: ${statements.length}`);

const BATCH_SIZE = 500; // Execute 500 statements at a time
const batches = [];

for (let i = 0; i < statements.length; i += BATCH_SIZE) {
  const batch = statements.slice(i, Math.min(i + BATCH_SIZE, statements.length));
  batches.push(batch);
}

console.log(`Split into ${batches.length} batches of up to ${BATCH_SIZE} statements each\n`);

// Write each batch
batches.forEach((batch, idx) => {
  const filename = `./scripts/sql-batches/batch-${idx.toString().padStart(2, '0')}.json`;
  fs.mkdirSync('./scripts/sql-batches', { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
  console.log(`Batch ${idx}: ${batch.length} statements`);
});

console.log(`\nAll batches written to ./scripts/sql-batches/`);









