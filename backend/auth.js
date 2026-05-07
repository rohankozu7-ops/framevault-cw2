const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { CosmosClient } = require("@azure/cosmos");

const router = express.Router();

async function getContainer(containerName) {
  const client = new CosmosClient({
    endpoint: "https://framevaultdb.documents.azure.com:443/",
    key: process.env.COSMOS_KEY
  });
  const database = client.database("framevault");
  const container = database.container(containerName);
  return container;
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    const container = await getContainer("users");
    const { resources } = await container.items
      .query({ query: "SELECT * FROM c WHERE c.email = @email", parameters: [{ name: "@email", value: email }] })
      .fetchAll();
    if (resources.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = { id: uuidv4(), email, passwordHash, createdAt: new Date().toISOString() };
    await container.items.create(newUser);
    res.status(201).json({ message: "Sign up successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const container = await getContainer("users");
    const { resources } = await container.items
      .query({ query: "SELECT * FROM c WHERE c.email = @email", parameters: [{ name: "@email", value: email }] })
      .fetchAll();
    if (resources.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const user = resources[0];
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
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