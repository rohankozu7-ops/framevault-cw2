const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const authMiddleware = require("./authMiddleware");

const router = express.Router();
const mediaFile = path.join(__dirname, "data", "media.json");
const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

if (!fs.existsSync(path.dirname(mediaFile))) {
  fs.mkdirSync(path.dirname(mediaFile), { recursive: true });
}

if (!fs.existsSync(mediaFile)) {
  fs.writeFileSync(mediaFile, "[]");
}

function readMedia() {
  return JSON.parse(fs.readFileSync(mediaFile, "utf8"));
}

function writeMedia(items) {
  fs.writeFileSync(mediaFile, JSON.stringify(items, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

router.post("/", authMiddleware, upload.single("image"), (req, res) => {
  const { title } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  const items = readMedia();

  const newItem = {
    id: uuidv4(),
    userId: req.user.userId,
    title: title || req.file.originalname,
    fileName: req.file.filename,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    url: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString()
  };

  items.unshift(newItem);
  writeMedia(items);

  res.status(201).json(newItem);
});

router.get("/", authMiddleware, (req, res) => {
  const items = readMedia();
  const userItems = items.filter(item => item.userId === req.user.userId);
  res.json(userItems);
});

router.delete("/:id", authMiddleware, (req, res) => {
  const items = readMedia();

  const item = items.find(
    media => media.id === req.params.id && media.userId === req.user.userId
  );

  if (!item) {
    return res.status(404).json({ message: "Media not found" });
  }

  const filtered = items.filter(media => media.id !== req.params.id);
  writeMedia(filtered);

  const filePath = path.join(uploadFolder, item.fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ message: "Deleted successfully" });
});

module.exports = router;