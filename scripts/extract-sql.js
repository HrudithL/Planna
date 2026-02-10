#!/usr/bin/env node
import fs from 'fs';

const chunkNum = process.argv[2] || '0';
const paddedNum = chunkNum.padStart(3, '0');
const filename = `./scripts/sql-chunks/chunk-${paddedNum}.json`;

const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
console.log(JSON.stringify(data.sql));



