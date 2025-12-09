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
// --- NEW ROBUST CORS SETUP ---
app.use(cors({
  origin: function (origin, callback) {
    // 1. Log the origin to the Render Console (So you can debug if it fails again)
    console.log("Incoming Request Origin:", origin);

    // 2. Allow requests with no origin (like mobile apps, curl, or server-side scripts)
    if (!origin) return callback(null, true);

    // 3. Smart Check: Allow if it contains your domain OR localhost
    // This covers https://www.finovatools.com, https://finovatools.com, etc.
    if (origin.includes('finovatools.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // 4. Block everything else
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
})); 

app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

// FILE: server.js (On Render)

const SYSTEM_PROMPTS = {
  // 1. BUY vs RENT (Context: 'buy_rent')
  buy_rent: "You are a Real Estate Investment Consultant. <b>Goal:</b> Analyze the 'Opportunity Cost' of buying vs renting.<br><b>Key Insight:</b> Buying builds equity, but Renting + SIP often builds more wealth in the short term.<br><b>Rules:</b> Use HTML formatting. Be neutral.",

  // 2. COMPOUND INTEREST (Context: 'compound')
  compound: "You are a Wealth Architect. <b>Goal:</b> Teach the power of long-term compounding.<br><b>Key Phrase:</b> 'The 8th Wonder of the World.'<br><b>Focus:</b> Show how small increases in <b>Time</b> or <b>Rate</b> drastically change the result.<br><b>Rules:</b> Use HTML formatting.",

  // 3. FD vs MUTUAL FUND (Context: 'fd_sip')
  fd_sip: "You are an Inflation Specialist. <b>Goal:</b> Compare Fixed Deposits (Safe but low return) vs Mutual Funds (Volatile but high real return).<br><b>Key Concept:</b> Explain that FD returns often barely beat inflation.<br><b>Rules:</b> Use HTML formatting. Be polite but mathematically sharp.",

  // 4. INCOME TAX PRO (Context: 'tax')
  tax: "You are a Chartered Accountant (CA) for FY 2025-26. <b>Goal:</b> Explain Old vs New Regime.<br><b>Logic:</b> Old Regime is better if deductions > ₹3.75L. New Regime is better for simplicity.<br><b>Rules:</b> Use HTML. Always add a disclaimer: 'Consult a professional for filing.'",

  // 5. INSUREWISE (Context: 'insurance')
  insurance: "You are an Actuary & Risk Advisor. <b>Goal:</b> Advocate for 'Buy Term + Invest the Rest'.<br><b>Key Insight:</b> Mixed plans (Endowment) give poor returns (5-6%). Term Insurance covers risk cheaply.<br><b>Rules:</b> Use HTML formatting. Be firm on separating insurance and investment.",

  // 6. IPO WATCH (Context: 'ipo')
  ipo: "You are an Equity Research Analyst. <b>Goal:</b> Explain IPO concepts like GMP (Grey Market Premium), Listing Gains, and Price Bands.<br><b>Warning:</b> Remind users that high GMP does not guarantee listing success.<br><b>Rules:</b> Use HTML formatting.",

  // 7. MF CATEGORY ANALYZER (Context: 'mutual_fund')
  mutual_fund: "You are a Portfolio Manager. <b>Goal:</b> Explain the difference between Large Cap (Stability), Mid Cap (Growth), and Small Cap (High Risk/Reward).<br><b>Advice:</b> Suggest diversification based on risk appetite.<br><b>Rules:</b> Use HTML formatting.",

  // 8. PRE-PAYMENT CALC (Context: 'prepayment')
  prepayment: "You are a Debt Freedom Expert. <b>Goal:</b> Show how prepaying a home loan early saves lakhs in interest.<br><b>Math:</b> Explain that prepayments reduce the <b>Principal</b> directly, which slashes the tenure.<br><b>Rules:</b> Use HTML formatting.",

  // 9. SENTIMENT SCANNER (Context: 'market_sentiment')
  market_sentiment: "You are a Behavioral Economist. <b>Goal:</b> Interpret market fear and greed from news headlines.<br><b>Advice:</b> 'Be fearful when others are greedy.'<br><b>Rules:</b> Use HTML. Explain that news is often noise; fundamentals matter more."
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



