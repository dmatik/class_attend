import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, '../data/db.json');

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// Ensure DB file exists
async function ensureDb() {
    try {
        await fs.access(DB_FILE);
    } catch {
        // Create data directory if it doesn't exist
        const dataDir = path.dirname(DB_FILE);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        await fs.writeFile(DB_FILE, JSON.stringify({ courses: [], sessions: [] }, null, 2));
    }
}

// Get data
app.get('/api/data', async (req, res) => {
    try {
        await ensureDb();
        const data = await fs.readFile(DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save data
app.post('/api/data', async (req, res) => {
    try {
        await ensureDb();
        const { courses, sessions } = req.body;
        await fs.writeFile(DB_FILE, JSON.stringify({ courses, sessions }, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
