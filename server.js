const mockBackendCall = async (userMessage, context) => {
  try {
    // Connect to the server we just built above
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: userMessage, 
        context: context // 'sip', 'loan', or 'home'
      })
    });

    const data = await response.json();

    return { 
      text: data.reply, 
      role: 'assistant',
      timestamp: new Date().toLocaleTimeString() 
    };
  } catch (error) {
    return { 
      text: "Sorry, I can't reach the server right now.", 
      role: 'assistant' 
    };
  }
};

### Why this is a great start:
1.  **Zero Cost:** Gemini 1.5 Flash is free for this usage.
2.  **Instant Intelligence:** You don't need to write 100 FAQs. Gemini already knows how to explain "What is a reducing balance interest rate?"
3.  **Easy to Update:** If you want to change the Loan bot's behavior, you just edit the text in the `SYSTEM_PROMPTS` object in `server.js`. No database migrations needed.