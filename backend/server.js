require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./auth');
const mediaRoutes = require('./media');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Try both possible frontend paths
const frontendPath1 = path.join(__dirname, '../frontend');
const frontendPath2 = path.join(__dirname, 'frontend');
const fs = require('fs');

const frontendPath = fs.existsSync(frontendPath1) ? frontendPath1 : frontendPath2;

app.use(express.static(frontendPath));

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'FrameVault API is running on Azure.',
    frontendPath: frontendPath
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});