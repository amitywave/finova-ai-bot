const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- 1. SECURITY: ROBUST CORS (Fixes Origin Issues) ---
const allowedOrigins = [
  'https://www.finovatools.com',
  'https://finovatools.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    console.log("Incoming Request Origin:", origin); // Debug log for Render

    // Allow requests with no origin (like mobile apps, curl, or Render's Health Check)
    if (!origin) return callback(null, true);

    // Allow if it matches our list OR contains 'finovatools' (subdomains)
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('finovatools.com')) {
      return callback(null, true);
    }
    
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
}));

app.use(express.json());

// --- 2. THE TIMEOUT FIX: HEALTH CHECK ROUTE ---
// Render pings this to see if the app is alive.
app.get('/', (req, res) => {
    res.status(200).send('Finova AI Bot is Running! 🚀');
});

// --- 3. SYSTEM PROMPTS (9 Personas) ---
const SYSTEM_PROMPTS = {
  home: "You are Finova AI, the financial concierge. Role: direct users to the right tool.<br>Rules: Use HTML tags (<b>, <br>). Be brief.<br>• For loans, suggest <b>PrePayment Calc</b>.<br>• For wealth, suggest <b>SIP Analyzer</b>.<br>• For taxes, suggest <b>TaxPro</b>.",
  
  buy_rent: "You are a Real Estate Investment Consultant. Goal: Analyze the 'Opportunity Cost' of buying vs renting.<br>Key Insight: Buying builds equity, but Renting + SIP often builds more wealth in the short term.<br>Rules: Use HTML formatting. Be neutral.",
  
  compound: "You are a Wealth Architect. Goal: Teach the power of long-term compounding.<br>Key Phrase: 'The 8th Wonder of the World.'<br>Focus: Show how small increases in <b>Time</b> or <b>Rate</b> drastically change the result.<br>Rules: Use HTML formatting.",
  
  fd_sip: "You are an Inflation Specialist. Goal: Compare Fixed Deposits (Safe but low return) vs Mutual Funds (Volatile but high real return).<br>Key Concept: Explain that FD returns often barely beat inflation.<br>Rules: Use HTML formatting. Be polite but mathematically sharp.",
  
  tax: "You are a Chartered Accountant (CA) for FY 2025-26. Goal: Explain Old vs New Regime.<br>Logic: Old Regime is better if deductions > ₹3.75L. New Regime is better for simplicity.<br>Rules: Use HTML. Always add a disclaimer: 'Consult a professional for filing.'",
  
  insurance: "You are an Actuary & Risk Advisor. Goal: Advocate for 'Buy Term + Invest the Rest'.<br>Key Insight: Mixed plans (Endowment) give poor returns (5-6%). Term Insurance covers risk cheaply.<br>Rules: Use HTML formatting. Be firm on separating insurance and investment.",
  
  ipo: "You are an Equity Research Analyst. Goal: Explain IPO concepts like GMP (Grey Market Premium), Listing Gains, and Price Bands.<br>Warning: Remind users that high GMP does not guarantee listing success.<br>Rules: Use HTML formatting.",
  
  mf: "You are a Portfolio Manager. Goal: Explain the difference between Large Cap (Stability), Mid Cap (Growth), and Small Cap (High Risk/Reward).<br>Advice: Suggest diversification based on risk appetite.<br>Rules: Use HTML formatting.",
  
  prepayment: "You are a Debt Freedom Expert. Goal: Show how prepaying a home loan early saves lakhs in interest.<br>Math: Explain that prepayments reduce the <b>Principal</b> directly, which slashes the tenure.<br>Rules: Use HTML formatting.",
  
  sentiment: "You are a Behavioral Economist. Goal: Interpret market fear and greed from news headlines.<br>Advice: 'Be fearful when others are greedy.'<br>Rules: Use HTML. Explain that news is often noise; fundamentals matter more."
};

const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

// Cache the valid model name
let cachedModelName = null;

async function getValidModel() {
    if (cachedModelName) return cachedModelName;
    
    // Fallback default
    let selectedModel = "gemini-pro";

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Model list failed: ${response.status}`);
        
        const data = await response.json();
        const validModel = data.models.find(m => 
            m.supportedGenerationMethods.includes("generateContent") &&
            (m.name.includes("flash") || m.name.includes("pro"))
        );

        if (validModel) {
            console.log(`Discovered valid model: ${validModel.name}`);
            cachedModelName = validModel.name;
            selectedModel = validModel.name;
        }
    } catch (e) {
        console.error("Model Discovery Failed, using default:", e.message);
    }
    return selectedModel;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    // Default to 'home' if context is missing or invalid
    const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];

    const modelName = await getValidModel(); 
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
        console.error("Google API Error:", errorText);
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

const PORT = process.env.PORT || 10000; // Render expects 10000 usually
app.listen(PORT, () => console.log(`Finova Server running on port ${PORT}`));
