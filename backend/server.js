require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./auth');
const mediaRoutes = require('./media');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FrameVault API is running.' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/home.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});