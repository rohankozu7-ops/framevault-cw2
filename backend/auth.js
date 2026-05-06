const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const usersFile = path.join(__dirname, "../data/users.json");

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const users = readUsers();
  const exists = users.find(user => user.email === email);

  if (exists) {
    return res.status(409).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);

  res.status(201).json({ message: "Sign up successful" });
});
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const users = readUsers();
  const user = users.find(user => user.email === email);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);

  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    message: "Login successful",
    token
  });
});

module.exports = router;