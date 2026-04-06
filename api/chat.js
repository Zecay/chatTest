// pages/api/chat.js
export default async function handler(req, res) {
  // ===== CRITICAL: Set CORS headers FIRST =====
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed. Use POST." });
  }

  try {
    const { messages, username, aiTier, aiName, generateImage } = req.body || {};
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "No messages provided." });
    }

    let model = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";
    const tier = aiTier || "default";

    if (tier === "go") {
      model = "GO_MODEL_REAL";
      tierInfo = `GO TIER: Can remember up to 30 past messages`;
    } else if (tier === "plus") {
      model = "PLUS_MODEL_REAL";
      tierInfo = `PLUS TIER: Unlimited memory, best quality`;
    } else {
      tierInfo = `DEFAULT TIER: Can remember up to 10 past messages`;
    }

    const systemMessage = {
      role: "system",
      content: `You are Zecay AI, a friendly assistant. User: ${username || "Player"}. ${tierInfo}`
    };

    let maxMemory = 20;
    if (tier === "go") maxMemory = 60;
    if (tier === "plus") maxMemory = messages.length;

    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

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

    return res.status(200).json({
      reply,
      generateImageProcessed: !!generateImage
    });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
