const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));

app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// We can now use 'gemini-1.5-flash' because we upgraded the package.json
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const SYSTEM_PROMPTS = {
  home: `
    You are Finova AI, a helpful assistant. Guide users to calculators.
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
  // (You can add other contexts 'sip', 'tax' etc here if needed later)
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];

    const prompt = `System: ${activeInstruction}\nUser: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });

  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({ reply: "I am upgrading my brain right now. Please try again in 1 minute." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Finova AI Server running on port ${PORT}`));
