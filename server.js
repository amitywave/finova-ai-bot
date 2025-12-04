const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow connections from your Hostinger site
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";

// --- THE ROBUST MODEL LIST ---
// If the first one fails, the server will automatically try the next one.
const MODELS_TO_TRY = [
    "gemini-1.5-flash", 
    "gemini-pro", 
    "gemini-1.5-pro-latest"
];

const SYSTEM_PROMPTS = {
  home: "You are Finova AI. Guide users: Investing->SIP Calc, Debt->Loan Calc, Taxes->TaxPro. Keep it short.",
  prepayment: "You are a Debt Freedom Expert. Explain that Prepayment cuts Principal and reduces Tenure. Keep it short."
};

// Function to call Google API
async function callGoogleAI(modelName, instruction, userMessage) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    const payload = {
        contents: [{ parts: [{ text: `System: ${instruction}\nUser: ${userMessage}` }] }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(response.status); // Throw 404 or 500 to trigger retry
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;
  const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];
  
  // --- SMART FALLBACK LOOP ---
  for (const model of MODELS_TO_TRY) {
      try {
          console.log(`Trying model: ${model}...`);
          const reply = await callGoogleAI(model, activeInstruction, message);
          
          // If we get here, it worked! Send response and exit loop.
          return res.json({ reply: reply });
          
      } catch (error) {
          console.error(`Model ${model} failed with error: ${error.message}`);
          // Continue to the next model in the list...
      }
  }

  // If ALL models fail:
  res.status(500).json({ reply: "I am having trouble connecting to Google's servers right now. Please check your API Key." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Finova Auto-Fallback Server running on port ${PORT}`));
