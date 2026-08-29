#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

const distCli = path.join(__dirname, '../dist/cli.js');

if (!fs.existsSync(distCli)) {
  console.error('ship-risk has not been built yet. Please run "npm run build" first.');
  process.exit(1);
}

const { runCli } = require(distCli);
runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
