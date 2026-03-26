const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { MongoClient } = require('mongodb');

loadLocalEnv();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'portfolio';
const COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME || 'contacts';

if (!MONGO_URI) {
  throw new Error('Missing MONGO_URI. Add it to .env.local or your environment.');
}

let clientPromise;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envText = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getMongoClient() {
  if (!clientPromise) {
    const client = new MongoClient(MONGO_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getContactsCollection() {
  const client = await getMongoClient();
  return client.db(DB_NAME).collection(COLLECTION_NAME);
}

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const contacts = await getContactsCollection();
    const result = await contacts.insertOne({
      name,
      email,
      message,
      created_at: new Date()
    });

    return res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('MongoDB insert error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
});

app.get('/admin/messages', async (_req, res) => {
  try {
    const contacts = await getContactsCollection();
    const rows = await contacts
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    const html = `<h2>Messages</h2><ul>${rows.map((row) => `<li><strong>${escapeHtml(row.name || '')}</strong> (${escapeHtml(row.email || '')}) - ${formatDate(row.created_at)}<br/>${escapeHtml(row.message || '')}</li>`).join('')}</ul>`;
    return res.send(html);
  } catch (error) {
    console.error('MongoDB read error:', error);
    return res.status(500).send('Error reading messages');
  }
});

app.listen(PORT, () => {
  console.log(`Server listening: http://localhost:${PORT}`);
  console.log(`MongoDB target: ${DB_NAME}.${COLLECTION_NAME}`);
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  return date.toLocaleString();
}
