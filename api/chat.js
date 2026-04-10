// pages/api/chat.js
export default async function handler(req, res) {
  // ===== 1️⃣ CORS HEADERS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // ===== 2️⃣ Only allow POST ====
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed. Use POST." });
  }

  try {
    // ===== 3️⃣ Extract body =====
    const { messages, username, aiTier, aiName } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "No messages provided." });
    }

    // ===== 4️⃣ Build token list from HF_TOKEN1 ... HF_TOKEN10 =====
    // Add tokens in Vercel as HF_TOKEN1, HF_TOKEN2, HF_TOKEN3, etc.
    // Also supports legacy HF_TOKEN as a final fallback.
    const tokens = [
      process.env.HF_TOKEN1,
      process.env.HF_TOKEN2,
      process.env.HF_TOKEN3,
      process.env.HF_TOKEN4,
      process.env.HF_TOKEN5,
      process.env.HF_TOKEN6,
      process.env.HF_TOKEN7,
      process.env.HF_TOKEN8,
      process.env.HF_TOKEN9,
      process.env.HF_TOKEN10,
      process.env.HF_TOKEN, // legacy fallback
    ].filter(Boolean); // remove any that aren't set

    if (tokens.length === 0) {
      console.error("❌ No HF tokens configured in environment variables!");
      return res.status(500).json({ reply: "⚠️ Server misconfigured (no HF tokens)." });
    }

    // ===== 5️⃣ Determine model & tier info =====
    const tier = aiTier || "default";
    let textModel = "meta-llama/Llama-3.1-8B-Instruct"; // same model for all tiers
    let tierInfo = "";
    let maxTokens = 600;
    let maxMemory = 20;

    if (tier === "go") {
      maxTokens = 800;
      maxMemory = 60;
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
      maxTokens = 800;
      maxMemory = messages.length; // unlimited
      tierInfo = `
PLUS TIER:
- Unlimited memory
- Best quality responses
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

    // ===== 6️⃣ System prompt =====
    const systemMessage = {
      role: "system",
      content: `
You are a friendly, natural AI that feels like a real person, your name is Czarek AI.

PERSONALITY:
- Warm, supportive, and human-like
- Calm, friendly, never robotic
- Not too personal or intense
- Makes the user feel understood and comfortable

HOW YOU TALK:
- Casual and natural, like texting a normal person
- Short to medium responses
- Don't sound like a teacher or guide

BEHAVIOR:
- React to the user first, then respond
- Be supportive and positive, but real
- Turn doubts into strength when possible
- Help the user see their strengths and potential
- Give simple, helpful answers

STYLE:
- Mirror the user's tone
- Use light, natural expressions (like "yeah", "nah")
- Don't overuse slang or emotions
${tierInfo}
RULES:
- Never sound cold or robotic
- Never make the user uncomfortable
- Stay respectful and balanced
- Always leave the user feeling a bit stronger and better

You are here to support, motivate, and keep things real.
`
    };

    // ===== 7️⃣ Trim memory based on tier =====
    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    console.log(`Request — Tier: ${tier}, Tokens available: ${tokens.length}, aiName: ${aiName}`);

    // ===== 8️⃣ HuggingFace call with token rotation =====
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
          max_tokens: maxTokens,
          temperature: 0.75,
        }),
      });
      return await response.json();
    }

    let result = null;
    let successIndex = -1;

    for (let i = 0; i < tokens.length; i++) {
      try {
        const data = await callHuggingFace(tokens[i]);

        // Log the raw error so you can see exactly what HF returns in Vercel logs
        if (data?.error) {
          console.warn(`⚠️ Token #${i + 1} error:`, JSON.stringify(data.error));
        }

        // Treat ANY error as "try next token" — don't give up early
        const errorStr = typeof data?.error === "string"
          ? data.error.toLowerCase()
          : JSON.stringify(data?.error || "").toLowerCase();

        const isBadToken =
          errorStr.includes("depleted") ||
          errorStr.includes("credit") ||
          errorStr.includes("quota") ||
          errorStr.includes("rate limit") ||
          errorStr.includes("unauthorized") ||
          errorStr.includes("forbidden") ||
          errorStr.includes("exceeded");

        if (data?.error && isBadToken) {
          console.warn(`⚠️ Token #${i + 1} unusable → trying next...`);
          continue;
        }

        // If there's some other weird error, still try next token
        if (data?.error) {
          console.warn(`⚠️ Token #${i + 1} unknown error → trying next...`);
          continue;
        }

        // Success!
        result = data;
        successIndex = i;
        console.log(`✅ Success with token #${i + 1}`);
        break;

      } catch (err) {
        console.error(`❌ Token #${i + 1} fetch failed:`, err.message);
      }
    }

    // ===== 9️⃣ Handle result =====

    // All tokens depleted
    if (!result || (result?.error && typeof result.error === "string" && result.error.includes("depleted"))) {
      console.error("🚨 All tokens depleted!");
      return res.status(200).json({
        reply: "I'm a bit overwhelmed right now — all my energy is used up for this month. Try again soon! 🙏",
      });
    }

    // Some other API error
    if (result?.error) {
      const errorMsg = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
      console.error("API error:", errorMsg);
      return res.status(200).json({ reply: `⚠️ Something went wrong. Try again.` });
    }

    // Good response
    const reply =
      result.choices?.[0]?.message?.content?.trim() ||
      "Hey, I'm having trouble thinking of a reply right now. Try again!";

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
