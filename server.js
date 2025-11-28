import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).send('Not found');
  }
  
  const indexPath = join(__dirname, 'dist', 'index.html');
  try {
    const indexContent = readFileSync(indexPath, 'utf-8');
    res.send(indexContent);
  } catch (error) {
    res.status(404).send('Frontend not built. Please run npm run build first.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

