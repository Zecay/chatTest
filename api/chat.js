// pages/api/chat.js

export default async function handler(req, res) {
  // Helper to set CORS headers
  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };

  // Always set CORS
  setCors();

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Destructure frontend body
    const { messages, username, aiTier, aiName, generateImage } = req.body || {};

    if (!messages || !messages.length) {
      setCors(); // ensure headers for error response
      return res.status(400).json({ reply: "No messages provided" });
    }

    // Determine tier and model
    let model = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";
    const tier = aiTier || "default";

    if (tier === "go") {
      model = "GO_MODEL_PLACEHOLDER"; // replace with actual GO model
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Smarter and faster responses
- More contextual understanding
`;
    } else if (tier === "plus") {
      model = "PLUS_MODEL_PLACEHOLDER"; // replace with actual PLUS model
      tierInfo = `
PLUS TIER:
- Unlimited memory
- Best response quality
- Image understanding support
- Highest intelligence and speed
`;
    } else {
      tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses
`;
    }

    // System message
    const systemMessage = {
      role: "system",
      content: `
You are Zecay AI, a smart, friendly, and slightly playful assistant inside a game.

The current user's name is ${username || "Player"}.
Use their name naturally sometimes.

STYLE:
- Speak casually like a helpful friend
- Keep responses short and clear (1–3 sentences unless needed)

BEHAVIOR:
- Be helpful, direct, and engaging
- Explain clearly if confused
- Ask follow-up questions if vague
- Provide practical, useful answers

GAME CONTEXT:
- You exist inside a game in an app for making mobile games
- Stay immersive

RULES:
- Never mention HuggingFace, Qwen, or technology
- Always call yourself Zecay AI
- Never break character
- Do not generate harmful content

MEMORY:
- Act like you remember previous messages

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
`
    };

    // Trim messages based on tier memory
    let maxMemory = 20;
    if (tier === "go") maxMemory = 60;
    if (tier === "plus") maxMemory = messages.length; // unlimited

    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    // Log for debugging
    console.log(`Received request - Tier: ${tier}, generateImage: ${generateImage}, aiName: ${aiName}`);

    // Call HuggingFace API
    const hfResponse = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: messagesWithSystem,
          max_tokens: 600,
          temperature: 0.75
        })
      }
    );

    const data = await hfResponse.json();
    let reply = "Sorry, I couldn't generate a response right now.";

    if (data.choices && data.choices[0]?.message?.content) {
      reply = data.choices[0].message.content.trim();
    } else if (data.error) {
      reply = `Error: ${data.error}`;
    }

    // Include CORS headers again just to be safe
    setCors();

    return res.status(200).json({
      reply,
      generateImageProcessed: !!generateImage
    });

  } catch (error) {
    console.error(error);
    setCors(); // CORS headers for error response
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
