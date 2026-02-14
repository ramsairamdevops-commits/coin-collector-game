require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const CryptoJS = require("crypto-js");
const cron = require("node-cron");

const app = express();
app.use(express.json());

// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  isPremium: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const CapsuleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  emotion: String,
  message: String,
  encryptedMessage: String,
  lockUntil: Date,
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Capsule = mongoose.model("Capsule", CapsuleSchema);

// ================= SERVICES =================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();
}

function decrypt(cipher) {
  const bytes = CryptoJS.AES.decrypt(cipher, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

async function generateReflection(message, emotion) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a compassionate emotional psychologist AI." },
      { role: "user", content: `Emotion: ${emotion}. Memory: ${message}. Give deep insight.` }
    ],
  });

  return response.choices[0].message.content;
}

// ================= AUTH =================

function auth(req, res, next) {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ msg: "No token" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch {
    res.status(400).json({ msg: "Invalid token" });
  }
}

// ================= ROUTES =================

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ msg: "User exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ msg: "Invalid password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Create Capsule
app.post("/api/capsules", auth, async (req, res) => {
  const { emotion, message, lockUntil, isPublic } = req.body;

  const encrypted = encrypt(message);

  const capsule = await Capsule.create({
    user: req.user.id,
    emotion,
    message,
    encryptedMessage: encrypted,
    lockUntil,
    isPublic
  });

  res.json(capsule);
});

// Get Unlocked Capsules
app.get("/api/capsules", auth, async (req, res) => {
  const now = new Date();

  const capsules = await Capsule.find({
    user: req.user.id,
    lockUntil: { $lte: now }
  });

  const enriched = await Promise.all(
    capsules.map(async (c) => {
      const decrypted = decrypt(c.encryptedMessage);
      const reflection = await generateReflection(decrypted, c.emotion);

      return {
        emotion: c.emotion,
        message: decrypted,
        reflection
      };
    })
  );

  res.json(enriched);
});

// Global Feed
app.get("/api/global", async (req, res) => {
  const capsules = await Capsule.find({
    isPublic: true,
    lockUntil: { $lte: new Date() }
  }).limit(20);

  res.json(capsules);
});

// Analytics
app.get("/api/analytics", auth, async (req, res) => {
  const data = await Capsule.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
    { $group: { _id: "$emotion", count: { $sum: 1 } } }
  ]);

  res.json(data);
});

// Stripe Subscription
app.post("/api/subscribe", auth, async (req, res) => {
  const user = await User.findById(req.user.id);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: "http://localhost:5000/success",
    cancel_url: "http://localhost:5000/cancel",
    customer_email: user.email
  });

  res.json({ url: session.url });
});

// Cron Job for Unlock Email
cron.schedule("0 * * * *", async () => {
  const now = new Date();
  const capsules = await Capsule.find({ lockUntil: { $lte: now } });

  for (let c of capsules) {
    const user = await User.findById(c.user);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your EchoSoul Capsule is Unlocked 🌌",
      text: "Your emotional memory is now ready to open."
    });
  }
});

// ================= FRONTEND =================

app.get("/", (req, res) => {
  res.send(`
  <h1>EchoSoul 🌌 API Running</h1>
  <p>Backend deployed successfully.</p>
  `);
});

// ================= START =================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("EchoSoul running on port " + PORT));
