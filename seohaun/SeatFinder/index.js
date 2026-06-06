require('dotenv').config();
const { runLoop } = require('./src/monitor');

runLoop().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
