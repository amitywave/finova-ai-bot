const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow connections from Live Site Finovatools AND Localhost (Safe Mode)
const allowedOrigins = [
  'https://www.finovatools.com',
  'https://finovatools.com',
  'http://localhost:5500',      // VS Code Live Server default
  'http://127.0.0.1:5500'       // Alternative Local IP
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
}));

app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

const SYSTEM_PROMPTS = {
  home: "You are Finova AI. Guide users: Investing->SIP Calc, Debt->Loan Calc, Taxes->TaxPro. Keep it short.",
  prepayment: "You are a Debt Freedom Expert. Explain that Prepayment cuts Principal and reduces Tenure. Keep it short."
};

// Cache the valid model name so we don't query it every time
let cachedModelName = null;

async function getValidModel() {
    if (cachedModelName) return cachedModelName;

    console.log("Discovering available models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to list models: ${response.status}`);
        
        const data = await response.json();
        
        // Find a model that supports generation and is either Flash or Pro
        const validModel = data.models.find(m => 
            m.supportedGenerationMethods.includes("generateContent") &&
            (m.name.includes("flash") || m.name.includes("pro"))
        );

        if (validModel) {
            console.log(`Discovered valid model: ${validModel.name}`);
            cachedModelName = validModel.name; // e.g., "models/gemini-1.5-flash-001"
            return cachedModelName;
        } else {
            throw new Error("No suitable Gemini model found for this key.");
        }
    } catch (e) {
        console.error("Model Discovery Failed:", e.message);
        // Fallback to a safe default if discovery fails entirely
        return "models/gemini-pro"; 
    }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];

    // 1. Get the correct model name dynamically
    const modelName = await getValidModel(); 
    
    // 2. Construct the URL using that specific model
    // Note: modelName usually comes as 'models/gemini-pro', so we don't add 'models/' prefix again if it's there
    const cleanModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${cleanModelName}:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [{ text: `System: ${activeInstruction}\nUser: ${message}` }]
      }]
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Google API Error Details:", errorText);
        throw new Error(`Google API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    res.json({ reply: text });

  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ reply: "I am having trouble connecting. Please check the server logs." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Finova Dynamic Server running on port ${PORT}`));

