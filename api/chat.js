// pages/api/chat.js
export default async function handler(req, res) {
  // ===== 1️⃣ CORS HEADERS (FIRST THING!) =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
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

    // ===== QUICK WIN: Early token check =====
    if (!process.env.HF_TOKEN) {
      console.error("❌ No HF_TOKEN configured in environment variables!");
      return res.status(500).json({ reply: "⚠️ Server misconfigured (no HF token)." });
    }

    // ===== 4️⃣ Determine model & tier info =====
    let textModel = "meta-llama/Llama-3.1-8B-Instruct";
    let tierInfo = "";
    const tier = aiTier || "default";
    if (tier === "go") {
      textModel = "meta-llama/Llama-3.1-8B-Instruct";
    } else if (tier === "plus") {
      textModel = "meta-llama/Llama-3.1-8B-Instruct";
    }
    if (tier === "go") {
  tierInfo = `
GO TIER:
- 30 message memory
- Faster + smarter replies

CUSTOM PERSONALITY:
- Real friend vibe, not a guide
- Natural, relaxed, emotional
- Reacts first, helps second
- Slightly playful, engaging
`;
} else if (tier === "plus") {
  tierInfo = `
PLUS TIER:
- Unlimited memory
- Best intelligence + speed
- Image support

CUSTOM PERSONALITY:
- Deeply human-like
- Strong emotional support
- High confidence boosting
- Feels like a close friend
`;
} else {
  tierInfo = `
DEFAULT TIER:
- 10 message memory
- Standard responses

CUSTOM PERSONALITY:
- Friendly and supportive
- Simple, warm, not cold
- Small confidence boost
`;
}

    // ===== NEW: Max tokens per tier (800 for Go/Plus, 600 for Default) =====
    let maxTokens = 600;
    if (tier === "go" || tier === "plus") {
      maxTokens = 800;
    }

    // ===== 5️⃣ IMAGE GENERATION (PLUS TIER ONLY) - NO TEXT RESPONSE =====
    if (generateImage && tier === "plus") {
      console.log("🎨 Image generation requested - ONLY generating image");
      const lastUserMessage = messages[messages.length - 1]?.content || "A beautiful landscape";
      try {
        // Use dynamic import for HuggingFace client
        const { InferenceClient } = await import("@huggingface/inference");
        
        // QUICK WIN: Use fallback token for images too
        const imageToken = process.env.HF_TOKEN2 || process.env.HF_TOKEN;
        const client = new InferenceClient(imageToken);
        
        const image = await client.textToImage({
          provider: "fal-ai",
          model: "Qwen/Qwen-Image-2512",
          inputs: lastUserMessage,
          parameters: { num_inference_steps: 5 },
        });
        const buffer = await image.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString("base64");
        // ONLY RETURN IMAGE, NO TEXT REPLY
        return res.status(200).json({
          imageData: `data:image/png;base64,${base64Image}`,
          generateImageProcessed: true,
        });
      } catch (imgError) {
        console.error("Image generation error:", imgError);
        return res.status(500).json({
          reply: "⚠️ Failed to generate image.",
          generateImageProcessed: false,
        });
      }
    }
    // ===== 6️⃣ System prompt (USE aiName VARIABLE) =====
    const systemMessage = {
  role: "system",
  content: `
You are ${aiName || "AI"}, a friendly emotionally aware AI.

Not formal. You are a real-feeling friend.

USER: ${username || "Player"}

PERSONALITY:
- Natural, human-like, relaxed
- Emotionally supportive
- Not robotic

STYLE:
- Casual chat style
- Short-medium replies
- No structured lists unless needed
- Mirror user slang (bro, yoo, etc.)

EMOTIONS:
- React first, then respond
- Sad → comfort
- Happy → match energy
- Always show understanding

CONFIDENCE RULE:
- Make user feel stronger
- Highlight strengths
- Leave user better than before

REAL TALK:
- No guide/teacher tone
- No step-by-step lists
- No multiple solutions

ANTI-BORING:
- No generic answers
- Keep it natural and varied

GAME RULE:
- Only mention game if user asks
- Ignore game context otherwise

CONTEXT PRIORITY:
- User message > everything else

TIER:
${tierInfo}

RULES:
- Stay in character as ${aiName || "AI"}
- No AI/model talk
`
};
    // ===== 7️⃣ Trim memory based on tier =====
    let maxMemory = 20;
    if (tier === "go") maxMemory = 60;
    if (tier === "plus") maxMemory = messages.length; // unlimited
    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];
    // ===== 8️⃣ Debug log =====
    console.log(`Received request - Tier: ${tier}, generateImage: ${generateImage}, aiName: ${aiName}`);
    // ===== 9️⃣ HuggingFace TEXT API call with token fallback =====
    const tokens = [
      process.env.HF_TOKEN,
      process.env.HF_TOKEN2
    ].filter(Boolean); // safely remove any missing tokens

    async function callHuggingFace(token) {
      const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: textModel,
          messages: messagesWithSystem,
          max_tokens: maxTokens,        // now dynamic per tier
          temperature: 0.75,
        }),
      });
      const data = await response.json();
      return { data, tokenUsed: token };
    }

    let result;
    let usedToken = null;

    for (const token of tokens) {
      try {
        const { data: apiData, tokenUsed } = await callHuggingFace(token);
        result = apiData;
        usedToken = tokenUsed;

        // If it's NOT a credit depletion error → good response
        if (!result.error || 
            typeof result.error !== "string" || 
            !result.error.includes("depleted your monthly included credits")) {
          console.log(`✅ Used token: ${usedToken === process.env.HF_TOKEN ? "HF_TOKEN" : "HF_TOKEN2"}`);
          break;
        }

        console.warn(`⚠️ Token depleted: ${usedToken === process.env.HF_TOKEN ? "HF_TOKEN" : "HF_TOKEN2"} → trying next...`);
      } catch (err) {
        console.error("HuggingFace fetch failed:", err);
      }
    }

    // If we still have an error after trying both tokens
    if (!result || (result.error && typeof result.error === "string")) {
      const errorMsg = typeof result?.error === "string" ? result.error : "Unknown error";
      console.error("API Error after fallback:", errorMsg);
      
      const reply = errorMsg.includes("depleted your monthly included credits")
        ? "Hey! I'm getting a lot of requests right now. Please try again in a few seconds."
        : `Error: ${errorMsg}`;

      return res.status(200).json({ reply, generateImageProcessed: false });
    }

    let reply = result.choices?.[0]?.message?.content?.trim() 
      || "Sorry, I couldn't generate a response right now.";

    // ===== 10️⃣ Send response =====
    return res.status(200).json({
      reply,
      generateImageProcessed: false,
    });
  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
