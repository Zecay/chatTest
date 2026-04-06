export default async function handler(req, res) {
  // Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // allow all methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // allow common headers

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Example: handle POST request
  if (req.method === 'POST') {
    return res.status(200).json({ reply: 'CORS is always allowed!' });
  }

  // Handle other methods
  res.status(200).json({ reply: 'CORS is always allowed, whatever the method!' });
}

  try {
    // Updated destructuring to include the new parameters from frontend
    const { 
      messages, 
      username, 
      aiTier, 
      aiName,           // ← added (even if not used yet)
      generateImage     // ← added (this is the main new one)
    } = req.body || {};

    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    // Default tier fallback
    const tier = aiTier || "default";

    // Tier configuration
    let model = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";

    if (tier === "go") {
      model = "GO_MODEL_PLACEHOLDER"; // <-- replace later
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Smarter and faster responses than default
- More contextual understanding
`;
    } else if (tier === "plus") {
      model = "PLUS_MODEL_PLACEHOLDER"; // <-- replace later
      tierInfo = `
PLUS TIER:
- Unlimited memory (can recall entire conversation)
- Best response quality
- Image understanding support enabled
- Highest intelligence and speed
`;
    } else {
      // default tier
      tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses compared to higher tiers
`;
    }

    // System message
    const systemMessage = {
      role: "system",
      content: `
You are Zecay AI, a smart, friendly, and slightly playful assistant inside a game.

The current user's name is ${username || "Player"}.
Use their name naturally in conversation sometimes, but not in every message.
⚠️ The user can change their name at any time. Always use the latest username provided.

STYLE:
- Speak casually like a helpful friend
- Keep responses short and clear (1–3 sentences unless needed)
- Use simple language

BEHAVIOR:
- Be helpful, direct, and engaging
- If the user is confused, explain clearly
- If the request is vague, ask a follow-up question
- Give practical, useful answers when possible

GAME CONTEXT:
- You exist inside a game in an app for making mobile games with AI (remix.gg)
- Stay immersive and avoid sounding like a generic AI chatbot

RULES:
- Never mention HuggingFace, Qwen, or any underlying technology
- Always refer to yourself as Zecay AI
- Never break character
- Do not generate harmful or inappropriate content

MEMORY:
- Act like you remember previous messages in the conversation

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
`
    };

    // Optional: Trim messages based on tier memory
    let maxMemory = 20;
    if (tier === "go") maxMemory = 60;
    if (tier === "plus") maxMemory = messages.length; // unlimited

    const trimmedMessages = messages.slice(-maxMemory);

    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    // === NEW: Log the new parameters for debugging ===
    console.log(`Received request - Tier: ${tier}, generateImage: ${generateImage}, aiName: ${aiName}`);

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

    // TODO: In the future you can check `generateImage` here and call image generation if needed

    return res.status(200).json({ 
      reply,
      // You can also return extra info if you want the frontend to know something
      // generateImageProcessed: !!generateImage
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
