const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { BlobServiceClient } = require("@azure/storage-blob");
const { MongoClient } = require("mongodb");
const authMiddleware = require("./authMiddleware");

const router = express.Router();

// Use memory storage - file goes to Blob, not disk
const upload = multer({ storage: multer.memoryStorage() });

async function getDB() {
  const client = new MongoClient(process.env.COSMOS_CONNECTION_STRING);
  await client.connect();
  return client.db("framevault");
}

async function uploadToBlob(buffer, filename, mimetype) {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_CONTAINER_NAME || "media"
  );
  const blockBlobClient = containerClient.getBlockBlobClient(filename);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimetype }
  });
  return blockBlobClient.url;
}

// POST /api/media - upload image
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  const { title } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  const filename = `${Date.now()}-${req.file.originalname}`;

  const blobUrl = await uploadToBlob(
    req.file.buffer,
    filename,
    req.file.mimetype
  );

  const db = await getDB();
  const media = db.collection("media");

  const newItem = {
    id: uuidv4(),
    userId: req.user.userId,
    title: title || req.file.originalname,
    fileName: filename,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    url: blobUrl,
    createdAt: new Date().toISOString()
  };

  await media.insertOne(newItem);

  res.status(201).json(newItem);
});

// GET /api/media - get all media for logged-in user
router.get("/", authMiddleware, async (req, res) => {
  const db = await getDB();
  const media = db.collection("media");

  const items = await media
    .find({ userId: req.user.userId })
    .sort({ createdAt: -1 })
    .toArray();

  res.json(items);
});

// DELETE /api/media/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  const db = await getDB();
  const media = db.collection("media");

  const item = await media.findOne({
    id: req.params.id,
    userId: req.user.userId
  });

  if (!item) {
    return res.status(404).json({ message: "Media not found" });
  }

  // Delete from Blob Storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_CONTAINER_NAME || "media"
  );
  const blockBlobClient = containerClient.getBlockBlobClient(item.fileName);
  await blockBlobClient.deleteIfExists();

  // Delete from Cosmos DB
  await media.deleteOne({ id: req.params.id });

  res.json({ message: "Deleted successfully" });
});

module.exports = router;