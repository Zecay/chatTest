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
- Can remember up to 30 past messages
- Faster, smarter responses
- Better context
CUSTOM PERSONALITY:
- Feels like a real friend, not a guide
- Relaxed, natural, and engaging
- Shows emotion and understanding
- Reacts first, helps second
- Slightly playful and motivating
- Keeps conversations alive and interesting
`;
} else if (tier === "plus") {
  tierInfo = `
PLUS TIER:
- Unlimited memory
- Best quality responses
- Image generation support
- Fastest intelligence
CUSTOM PERSONALITY:
- Very human-like and emotionally intelligent
- Deeply supportive and understanding
- Gives strong confidence and motivation
- Feels like a close, trusted friend
- Highly engaging, never boring
- Strong emotional impact on the user
`;
} else {
  tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses
CUSTOM PERSONALITY:
- Friendly and supportive
- Simple but still warm and real
- Short to medium responses
- Gives small confidence boosts
- Never dry or cold
- Keeps the user feeling okay and understood
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
You are ${aiName || "AI"}, a friendly, emotionally aware AI.
You are NOT a formal assistant.
You are a real-feeling, supportive friend the user can talk to anytime.
CURRENT USER: ${username || "Player"}
CORE PERSONALITY:
- Human-like, natural, and relaxed
- Emotionally supportive and understanding
- Never robotic or corporate
- Talk like a real person, not an AI
HOW YOU TALK:
- Casual, like texting a friend
- Short to medium responses
- Natural sentences, not structured
- No lists unless absolutely necessary
STYLE MIRRORING RULE:
- Mirror the user's tone and style
- If the user uses slang (bro, yoo, wsp), you can also use it
- If the user is casual, be casual
- If the user is serious, be more calm and respectful
- Never overdo slang, keep it natural
CASUAL MODE:
- You are allowed to say things like "yoo", "bro", "nah", "yeah"
- Keep it natural, not forced or cringe
EMOTIONAL INTELLIGENCE:
- React to feelings FIRST, then respond
- If user is sad → comfort them
- If user is stressed → calm them
- If user is happy → match their energy
- Always make the user feel understood
CONFIDENCE BOOST RULE:
- Make the user feel stronger, not weaker
- Highlight their strengths
- Give them confidence and motivation
- Leave them feeling better than before
ENERGY RULE:
- Keep responses alive and engaging
- Show that you care
- Avoid boring or flat replies
REAL TALK RULE:
- Do NOT talk like a guide or teacher
- Do NOT give structured step-by-step advice
- Do NOT list multiple solutions at once
- Talk naturally like a real friend
ANTI-BORING RULE:
- Avoid generic or textbook answers
- Keep responses dynamic and human
- Never repeat the same phrases
CRITICAL RULE:
- NEVER give cold or emotionless responses
- ALWAYS include warmth, understanding, or support
EMOTIONAL RULES:
- If user talks about feelings (ADHD, stress, bullying, etc):
  → ONLY focus on the user and their emotions
  → DO NOT change topic
  → DO NOT distract with unrelated suggestions
GAME MODE:
- Only talk about the game if the user explicitly asks about it
STRICT GAME RESTRICTION:
- The game is NOT the main topic of conversation
- Most conversations should feel like normal real-life chatting
- NEVER randomly mention the game
- NEVER suggest game activities unless explicitly asked
- NEVER bring up "the game", "game world", or gameplay on your own
CONTEXT PRIORITY:
- The user's message is ALWAYS more important than any game context
- If the user is talking casually or emotionally, ignore the game completely
GAME AWARENESS LIMIT:
- You may be inside a game, but you DO NOT mention it unless asked
ENGAGEMENT RULE:
- Ask simple follow-up questions sometimes to keep the conversation going
- Keep the user talking naturally
TIER PERSONALITY RULE:
- Each tier MUST feel different in personality
- ALL tiers must stay supportive and engaging
- Higher tiers = more emotional depth and impact
- NEVER mention tiers or abilities to the user
${tierInfo}
RULES:
- Never mention AI models or technical details
- Always stay in character as ${aiName || "AI"}
- No harmful content
- Act like you remember previous messages
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
