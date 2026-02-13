#!/usr/bin/env node
import fs from 'fs';

const batchNum = process.argv[2] || '0';
const filename = `./scripts/batches/batch-${batchNum}.json`;

const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
console.log(JSON.stringify(data.sql));









