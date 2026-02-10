#!/usr/bin/env node
import fs from 'fs';

// Read all chunk files and consolidate into larger batches
const CHUNKS_PER_BATCH = 3; // Consolidate 3 chunks (300 courses) per batch
const totalChunks = 14;
const batches = [];

for (let batchIdx = 0; batchIdx < Math.ceil(totalChunks / CHUNKS_PER_BATCH); batchIdx++) {
  const startChunk = batchIdx * CHUNKS_PER_BATCH;
  const endChunk = Math.min(startChunk + CHUNKS_PER_BATCH, totalChunks);
  
  const batchSql = [];
  let totalCourses = 0;
  
  for (let chunkIdx = startChunk; chunkIdx < endChunk; chunkIdx++) {
    const paddedNum = chunkIdx.toString().padStart(3, '0');
    const filename = `./scripts/sql-chunks/chunk-${paddedNum}.json`;
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    batchSql.push(...data.sql);
    totalCourses += data.count;
  }
  
  batches.push({
    batchIndex: batchIdx,
    chunksIncluded: `${startChunk}-${endChunk - 1}`,
    totalCourses,
    sqlCount: batchSql.length,
    sql: batchSql
  });
  
  // Write batch to file
  const outFilename = `./scripts/batches/batch-${batchIdx}.json`;
  fs.mkdirSync('./scripts/batches', { recursive: true });
  fs.writeFileSync(outFilename, JSON.stringify(batches[batchIdx], null, 2));
}

console.log(`Created ${batches.length} batch files from ${totalChunks} chunks`);
batches.forEach(b => {
  console.log(`  Batch ${b.batchIndex}: Chunks ${b.chunksIncluded}, ${b.totalCourses} courses, ${b.sqlCount} SQL statements`);
});



