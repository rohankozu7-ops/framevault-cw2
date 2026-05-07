const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const authMiddleware = require('./authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function getContainer() {
  const client = new CosmosClient({
    endpoint: 'https://framevaultdb.documents.azure.com:443/',
    key: process.env.COSMOS_KEY
  });
  return client.database('framevault').container('media');
}

async function uploadToBlob(buffer, filename, mimetype) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_CONTAINER_NAME || 'media'
  );
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimetype }
  });
  return blockBlobClient.url;
}

// UPLOAD
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'No image uploaded' });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const blobUrl = await uploadToBlob(req.file.buffer, filename, req.file.mimetype);
    const container = await getContainer();
    const newItem = {
      id: uuidv4(),
      userId: req.user.userId,
      title: req.body.title || req.file.originalname,
      fileName: filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      url: blobUrl,
      createdAt: new Date().toISOString()
    };
    await container.items.create(newItem);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// GET ALL MEDIA
router.get('/', authMiddleware, async (req, res) => {
  try {
    const container = await getContainer();
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@userId', value: req.user.userId }]
      })
      .fetchAll();
    res.json(resources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// DELETE
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const container = await getContainer();
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id AND c.userId = @userId',
        parameters: [{ name: '@id', value: req.params.id }, { name: '@userId', value: req.user.userId }]
      })
      .fetchAll();
    if (resources.length === 0)
      return res.status(404).json({ message: 'Media not found' });

    const item = resources[0];
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_CONTAINER_NAME || 'media'
    );
    await containerClient.getBlockBlobClient(item.fileName).deleteIfExists();
    await container.item(item.id, item.id).delete();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;