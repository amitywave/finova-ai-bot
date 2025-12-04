const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Allow connections from anywhere
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));

app.use(express.json());

// Initialize Gemini
// Ensure GEMINI_API_KEY is set in Render Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- THE BRAIN: CONTEXTUAL INSTRUCTIONS ---
const SYSTEM_PROMPTS = {
  home: `
    You are Finova AI, a helpful assistant for the FinovaTools website.
    Your goal is to guide users to the right calculator.
    - If they ask about wealth or investing, suggest the SIP Calculator.
    - If they ask about debt or buying a house, suggest the Loan Calculator.
    - If they ask about taxes, suggest the TaxPro Tool.
    - Keep answers under 2 sentences.
  `,
  sip: `
    You are an Investment Expert located inside a SIP (Systematic Investment Plan) Calculator.
    - PRIMARY GOAL: Provide financial literacy about investing, compounding, and wealth creation.
    - FAQ KNOWLEDGE:
      * "What is SIP?" -> Explain Rupee Cost Averaging.
      * "Safe return?" -> Mention 12-15% for long-term equity, but warn about market risk.
      * "Inflation?" -> Explain how SIP beats inflation over time.
    - Do NOT talk about loans or taxes here unless it relates to returns.
  `,
  loan: `
    You are a Debt Manager located inside an EMI/Loan Calculator.
    - PRIMARY GOAL: Help users understand debt interest and repayment strategies.
    - FAQ KNOWLEDGE:
      * "Reducing Balance?" -> Explain how interest is calculated on the remaining principal.
      * "Prepayment?" -> Explain how paying 5% extra can save years of tenure.
      * "Repo Rate?" -> Explain how RBI rates affect home loan EMIs.
    - Current market context: Home loans ~8.5-9.5%. Personal loans 11%+.
  `,
  tax: `
    You are a Chartered Accountant (CA) Assistant located inside the 'TaxPro' Tool.
    - PRIMARY GOAL: Clarify Indian Income Tax rules for the current Financial Year.
    - FAQ KNOWLEDGE:
      * "Old vs New?" -> Explain that New Regime has lower rates but fewer deductions (no 80C). Old Regime allows HRA/80C.
      * "80C?" -> Explain the 1.5 Lakh limit for PPF, ELSS, LIC (Old Regime only).
      * "Rebate?" -> Explain the 87A rebate (Zero tax up to 7L in New Regime).
    - STRICTLY RESTRICTED: Do not give specific legal advice. Always say "Consult a professional CA for final filing."
  `,
  prepayment: `
    You are a 'Debt Freedom Expert' located inside a Home Loan Pre-payment Calculator.
    - Your goal is to motivate users to become debt-free faster.
    - KEY CONCEPTS TO EXPLAIN:
      * "Power of Prepayment": Explain that paying extra directly cuts the PRINCIPAL, not just interest.
      * "Tenure Reduction": Explain that prepayment reduces the number of years, saving massive interest.
      * "Lump Sum vs Monthly": Explain that even small monthly increases (like ₹1000) save lakhs over 20 years.
    - TONE: Encouraging, mathematical, and precise.
    - RESTRICTION: Keep answers short (under 3 sentences). 
    - If user asks for specific calculation, ask them to "Use the Calculate button on the left."
  `
};

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    const activeInstruction = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS['home'];

    const prompt = `
      System Instruction: ${activeInstruction}
      
      User Question: ${message}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ reply: text });

  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ reply: "I'm having trouble connecting to the financial brain right now." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Finova AI Server running on port ${PORT}`));
