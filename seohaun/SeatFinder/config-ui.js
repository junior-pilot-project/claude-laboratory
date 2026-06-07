const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return res.json({ interval: 60, routes: [] });
  }
  const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  res.json(data);
});

app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3000, () => console.log('Config UI: http://localhost:3000'));
}

module.exports = app;
