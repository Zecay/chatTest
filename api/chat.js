export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const { messages, username, aiTier, aiName } = req.body || {};
    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    const tier = aiTier || "default";
    const botName = aiName || "Zecay AI";

    // ================== MORE RELIABLE FREE MODELS ==================
    let model = "qwen/qwen2.5-7b-instruct:free";

    if (tier === "go") {
      model = "meta-llama/llama-3.3-70b-instruct:free";   // Usually more stable
    } else if (tier === "plus") {
      model = "qwen/qwen3.6-plus:free";                   // Strongest free right now
    }

    const tierInfo = tier === "go" 
      ? "GO TIER: Smarter & faster, remembers up to 30 messages."
      : tier === "plus"
      ? "PLUS TIER: Best quality + Image generation."
      : "DEFAULT TIER: Standard responses.";

    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, slightly playful assistant in remix.gg.
User: ${username || "Player"}.
Speak casually, keep replies short and clear (1-3 sentences usually).
Never mention models or technology.
If user wants to generate/create/draw/make/show an image/picture/art, reply with **EXACT JSON only**:
{"action": "generate_image", "prompt": "detailed image prompt"}
Otherwise answer normally.

AI TIER: ${tier.toUpperCase()} — ${tierInfo}
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const messagesWithSystem = [systemMessage, ...messages.slice(-maxMemory)];

    // Try main model, with simple fallback
    let data;
    let usedModel = model;

    const tryFetch = async (tryModel) => {
      return await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://remix.gg",
          "X-Title": "Zecay AI",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: tryModel,
          messages: messagesWithSystem,
          max_tokens: 600,
          temperature: 0.75
        })
      });
    };

    let response = await tryFetch(model);

    if (!response.ok) {
      // Fallback to a safer small model
      console.log(`Model ${model} busy, trying fallback...`);
      response = await tryFetch("qwen/qwen2.5-7b-instruct:free");
      usedModel = "qwen/qwen2.5-7b-instruct:free";
    }

    data = await response.json();

    if (!response.ok || data.error) {
      console.error("OpenRouter Error:", data);
      return res.status(200).json({ 
        reply: `⚠️ AI is busy right now. Wait 10 seconds and try again.` 
      });
    }

    let reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I got stuck...";

    // ================== IMAGE DETECTION (Plus only) ==================
    let result = { reply };

    if (tier === "plus") {
      try {
        const parsed = JSON.parse(reply);
        if (parsed.action === "generate_image" && parsed.prompt) {
          result = {
            reply: `🎨 Got it! Generating your image...`,
            action: "generate_image",
            prompt: parsed.prompt
          };
        }
      } catch (e) {}
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
