import express from 'express';
import fs from 'fs';
import path from 'path';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const port = 3000;

// Read csv and json files to serve
const files = fs.readdirSync(__dirname, { recursive: true })
  .filter(x => ['csv', 'json'].includes(x.split('.').pop()))
  .filter(x => !x.includes('node_modules') && x.includes(path.sep))
  .sort()
  .map(x => ({
    folder: x.split(path.sep).shift(),
    file: x.split(path.sep).pop(),
    size: fs.statSync(x).size
  }));

const { jobs } = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf-8'));

const app = express();

for (let folder of ['www', ...files.map(({ folder }) => folder)]) {
  app.use(express.static(folder));
}

app.get('/api/file-list', (req, res) => {
  res.json(files);
});

app.get('/api/jobs', (req, res) => {
  res.json(jobs);
});


app.listen(port, () => console.log(`Listening on http://localhost:${port}`));