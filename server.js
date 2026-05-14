const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config(); // Need to install dotenv

const app = express();
const PORT = process.env.PORT || 3000;

// Use process.env.MONGO_URI from .env file
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

let dbInstance = null;

async function connectDB() {
  if (dbInstance) return dbInstance;
  if (!MONGO_URI || MONGO_URI === "YOUR_MONGODB_URI_HERE") {
    throw new Error("MongoDB URI is not configured correctly. Please update the .env file.");
  }
  
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  dbInstance = client.db('portfolio');
  console.log("Connected successfully to MongoDB server");
  return dbInstance;
}

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const db = await connectDB();
    const contactsCollection = db.collection('contacts');
    
    const result = await contactsCollection.insertOne({
      name,
      email,
      message,
      created_at: new Date()
    });

    return res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Contact form error:', error.message);
    // Send a clearer message back to the frontend
    return res.status(500).json({ error: 'Failed to connect to Database. Have you updated your MongoDB URI?' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  if (!MONGO_URI || MONGO_URI === "YOUR_MONGODB_URI_HERE") {
    console.warn("⚠️ WARNING: MONGO_URI is not set in the .env file! Please update it.");
  }
});
