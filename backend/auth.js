const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { MongoClient } = require("mongodb");

const router = express.Router();

async function getDB() {
  const client = new MongoClient(process.env.COSMOS_CONNECTION_STRING);
  await client.connect();
  return client.db("framevault");
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const db = await getDB();
    const users = db.collection("users");
    const exists = await users.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { id: uuidv4(), email, passwordHash, createdAt: new Date().toISOString() };
    await users.insertOne(newUser);
    res.status(201).json({ message: "Sign up successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await getDB();
    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

module.exports = router;