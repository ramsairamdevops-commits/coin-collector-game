// EchoSoul - Emotional Time Capsule App (Enhanced)
// Run: node echosoul.js
// Visit: http://localhost:5000

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fetch = require("node-fetch"); // for AI calls

const app = express();
app.use(express.json());

// --- MongoDB Setup ---
mongoose.connect("mongodb://localhost:27017/echosoul", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const CapsuleSchema = new mongoose.Schema({
  emotion: String,
  message: String,
  lockUntil: Date,
  createdAt: { type: Date, default: Date.now },
});
const Capsule = mongoose.model("Capsule", CapsuleSchema);

// --- AI Reflection (OpenAI placeholder) ---
async function generateReflection(message) {
  // Replace with actual OpenAI API call
  return `AI Insight: This memory reflects your ${message.length > 50 ? "deep" : "brief"} emotional state.`;
}

// --- API Routes ---
app.post("/api/capsules", async (req, res) => {
  const capsule = new Capsule(req.body);
  await capsule.save();
  res.json(capsule);
});

app.get("/api/capsules", async (req, res) => {
  const now = new Date();
  const capsules = await Capsule.find({ lockUntil: { $lte: now } }).sort({ createdAt: -1 });

  // Add AI reflection to unlocked capsules
  const enriched = await Promise.all(
    capsules.map(async (c) => ({
      ...c._doc,
      reflection: await generateReflection(c.message),
    }))
  );

  res.json(enriched);
});

// --- Resonance Matching ---
app.get("/api/resonance/:emotion", async (req, res) => {
  const emotion = req.params.emotion;
  const now = new Date();
  const capsules = await Capsule.find({
    emotion,
    lockUntil: { $lte: now },
  }).sort({ createdAt: -1 });
  res.json(capsules);
});

// --- Frontend ---
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>EchoSoul 🌌</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
  <style>
    body { font-family: sans-serif; background: linear-gradient(to bottom, #1a1a40, #4b0082); color: white; margin: 0; padding: 0; }
    nav { background: #2c2c54; padding: 10px; display: flex; justify-content: space-between; }
    .container { padding: 20px; }
    select, textarea, button { width: 100%; margin-top: 10px; padding: 10px; border-radius: 8px; border: none; }
    .capsule { background: rgba(255,255,255,0.1); padding: 10px; margin: 10px 0; border-radius: 8px; }
  </style>
</head>
<body>
  <nav>
    <h1>EchoSoul 🌌</h1>
    <div><button onclick="alert('Mobile app coming soon!')">Mobile</button></div>
  </nav>
  <div id="root" class="container"></div>

  <script type="text/babel">
    function App() {
      const [emotion, setEmotion] = React.useState("Joy");
      const [message, setMessage] = React.useState("");
      const [lockYears, setLockYears] = React.useState(1);
      const [capsules, setCapsules] = React.useState([]);
      const [resonance, setResonance] = React.useState([]);

      React.useEffect(() => {
        fetch("/api/capsules")
          .then(res => res.json())
          .then(data => setCapsules(data));
      }, []);

      const saveCapsule = async () => {
        const lockUntil = new Date();
        lockUntil.setFullYear(lockUntil.getFullYear() + parseInt(lockYears));
        await fetch("/api/capsules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emotion, message, lockUntil }),
        });
        setMessage("");
        const updated = await fetch("/api/capsules").then(res => res.json());
        setCapsules(updated);
      };

      const findResonance = async () => {
        const data = await fetch("/api/resonance/" + emotion).then(res => res.json());
        setResonance(data);
      };

      return (
        <div>
          <h2>Capture an Emotion</h2>
          <select value={emotion} onChange={e => setEmotion(e.target.value)}>
            <option>Joy</option>
            <option>Grief</option>
            <option>Awe</option>
            <option>Anxiety</option>
          </select>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the moment..."></textarea>
          <select value={lockYears} onChange={e => setLockYears(e.target.value)}>
            <option value="1">Lock for 1 year</option>
            <option value="5">Lock for 5 years</option>
            <option value="10">Lock for 10 years</option>
          </select>
          <button onClick={saveCapsule}>Save to Time Capsule</button>
          <button onClick={findResonance}>Find Resonance</button>

          <h2>Unlocked Capsules</h2>
          {capsules.map((c, i) => (
            <div key={i} className="capsule">
              <strong>{c.emotion}</strong>: {c.message}
              <p><em>{c.reflection}</em></p>
            </div>
          ))}

          <h2>Resonance Matches</h2>
          {resonance.map((r, i) => (
            <div key={i} className="capsule">
              <strong>{r.emotion}</strong>: {r.message}
            </div>
          ))}
        </div>
      );
    }

    ReactDOM.render(<App />, document.getElementById("root"));
  </script>
</body>
</html>
  `);
});

// --- Start Server ---
app.listen(5000, () => console.log("EchoSoul running at http://localhost:5000"));
