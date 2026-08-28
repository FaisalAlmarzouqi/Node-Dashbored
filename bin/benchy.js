#!/usr/bin/env node
const { buildCli } = require('../src/cli');

const program = buildCli();

program.parseAsync(process.argv).catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
