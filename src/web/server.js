const path = require('path');
const express = require('express');
const chalk = require('chalk');
const { getNodes, getNode } = require('../config/network');

async function startWebDashboard({ nodeFilter, port = 4000 }) {
  // Lazy require to avoid a circular require with infos.js
  const { collectAll } = require('../commands/infos');

  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/infos', async (req, res) => {
    try {
      const nodes = nodeFilter ? [getNode(nodeFilter)] : getNodes();
      const infos = await collectAll(nodes);
      res.json(infos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  await new Promise((resolve) => app.listen(port, resolve));
  console.log(chalk.green(`Benchy dashboard running at http://localhost:${port}`));
  console.log(chalk.gray('Press Ctrl+C to stop.'));
}

module.exports = { startWebDashboard };
