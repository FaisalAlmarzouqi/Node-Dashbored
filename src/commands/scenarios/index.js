const { scenario0 } = require('./scenario0');
const { scenario1 } = require('./scenario1');
const { scenario2 } = require('./scenario2');
const { scenario3 } = require('./scenario3');

const SCENARIOS = {
  0: scenario0,
  1: scenario1,
  2: scenario2,
  3: scenario3,
};

async function runScenario(id, opts) {
  const fn = SCENARIOS[id];
  if (!fn) {
    throw new Error(`Unknown scenario "${id}". Valid scenarios: 0, 1, 2, 3.`);
  }
  await fn(opts);
}

module.exports = { runScenario };
