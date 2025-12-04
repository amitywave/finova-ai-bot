const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));

app.use(express.json());

// --- CONFIGURATION ---
const API_KEY = process.env.GEMINI_API_KEY;
// We use the raw API endpoint for Gemini 1.5 Flash
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

const SYSTEM_PROMPTS = {
  home: `
    You are Finova AI, a helpful assistant.
    - Investing? Suggest SIP Calculator.
    - Debt? Suggest Loan Calculator.
    - Taxes? Suggest TaxPro Tool.
    Keep answers short.
  `,
  prepayment: `
    You are a 'Debt Freedom Expert' inside a Home Loan Pre-payment Calculator.
    - GOAL: Motivate users to become debt-free.
    - CONCEPTS:
      * paying extra cuts PRINCIPAL directly.
      * prepayment reduces tenure significantly.
      * small increases (like ₹1000) save lakhs.
    - Keep answers short (under 3 sentences).
  `
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];

    // Construct the payload for the RAW API
    const payload = {
      contents: [{
        parts: [{
          text: `System Instruction: ${activeInstruction}\n\nUser Question: ${message}`
        }]
      }]
    };

    // Make the request using standard fetch (No library needed)
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract text from the raw response structure
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

    res.json({ reply: text });

  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ reply: "I'm having trouble connecting to Google right now. Please check the logs." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Finova AI Server (Direct Mode) running on port ${PORT}`));
