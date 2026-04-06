// pages/api/chat.js

export default async function handler(req, res) {
  // ===== 1️⃣ CORS HEADERS (apply to all requests) =====
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") return res.status(200).end();

  // ===== 2️⃣ Only allow POST =====
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed. Use POST." });
  }

  try {
    // ===== 3️⃣ Extract body =====
    const { messages, username, aiTier, aiName, generateImage } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "No messages provided." });
    }

    // ===== 4️⃣ Determine model & tier info =====
    let model = "Qwen/Qwen2.5-7B-Instruct"; // default fallback
    let tierInfo = "";
    const tier = aiTier || "default";

    if (tier === "go") {
      model = "GO_MODEL_REAL"; // replace with actual HuggingFace GO model
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Faster, smarter responses
- Better context
`;
    } else if (tier === "plus") {
      model = "PLUS_MODEL_REAL"; // replace with actual HuggingFace PLUS model
      tierInfo = `
PLUS TIER:
- Unlimited memory
- Best quality responses
- Image support
- Fastest intelligence
`;
    } else {
      tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses
`;
    }

    // ===== 5️⃣ System prompt =====
    const systemMessage = {
      role: "system",
      content: `
You are Zecay AI, a friendly, slightly playful assistant inside a game.
Current user: ${username || "Player"}

STYLE:
- Casual, helpful friend
- Short, clear responses

BEHAVIOR:
- Explain clearly
- Ask follow-ups if vague
- Useful and practical answers

GAME CONTEXT:
- Inside a game-making app
- Stay immersive

RULES:
- Never mention HuggingFace, Qwen, or tech
- Always call yourself Zecay AI
- No harmful content

MEMORY:
- Act like you remember previous messages

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
`
    };

    // ===== 6️⃣ Trim memory based on tier =====
    let maxMemory = 20;
    if (tier === "go") maxMemory = 60;
    if (tier === "plus") maxMemory = messages.length; // unlimited

    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    // ===== 7️⃣ Debug log =====
    console.log(`Received request - Tier: ${tier}, generateImage: ${generateImage}, aiName: ${aiName}`);

    // ===== 8️⃣ HuggingFace API call =====
    const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
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
    });

    const data = await hfResponse.json();

    let reply = "Sorry, I couldn't generate a response right now.";
    if (data.choices && data.choices[0]?.message?.content) {
      reply = data.choices[0].message.content.trim();
    } else if (data.error) {
      reply = `Error: ${data.error}`;
    }

    // ===== 9️⃣ Send response =====
    return res.status(200).json({
      reply,
      generateImageProcessed: !!generateImage
    });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
