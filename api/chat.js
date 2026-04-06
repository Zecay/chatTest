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

    // ================== FREE MODELS ON OPENROUTER ==================
    let model = "qwen/qwen2.5-7b-instruct:free";   // Default fallback

    if (tier === "go") {
      model = "openai/gpt-oss-120b:free";           // Your requested Go model
      // Fallback if rate limited: "meta-llama/llama-3.3-70b-instruct:free"
    } else if (tier === "plus") {
      model = "qwen/qwen3.6-plus:free";             // Strongest free option right now
    }

    const tierInfo = tier === "go" 
      ? "GO TIER: Smarter responses, remembers up to 30 messages."
      : tier === "plus"
      ? "PLUS TIER: Highest quality + Image generation support."
      : "DEFAULT TIER: Basic helpful responses.";

    // ================== SYSTEM MESSAGE ==================
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, and slightly playful assistant inside remix.gg — an app for making mobile games with AI.
Current user name: ${username || "Player"}. Use their name naturally sometimes.
Speak casually like a helpful friend. Keep most replies short and clear (1–3 sentences).
Never mention models, OpenRouter, Hugging Face, or any technology.
If the user asks to **generate**, **create**, **draw**, **make**, or **show an image/picture/art/photo** of something, reply with **EXACT JSON only** and nothing else:
{"action": "generate_image", "prompt": "a very detailed, high-quality image prompt"}
Otherwise, just answer normally as text.

AI TIER ACTIVE: ${tier.toUpperCase()} — ${tierInfo}
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const messagesWithSystem = [systemMessage, ...messages.slice(-maxMemory)];

    // ================== CALL OPENROUTER ==================
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://remix.gg",        // Optional but good to set
        "X-Title": "Zecay AI",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messagesWithSystem,
        max_tokens: 600,
        temperature: 0.75
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("OpenRouter Error:", data);
      return res.status(200).json({ 
        reply: `⚠️ The AI is a bit busy right now (${tier} tier). Please try again in a few seconds.` 
      });
    }

    let reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I got stuck... Try again!";

    // ================== IMAGE DETECTION (Plus tier only) ==================
    let result = { reply };

    if (tier === "plus") {
      try {
        const parsed = JSON.parse(reply);
        if (parsed.action === "generate_image" && parsed.prompt) {
          result = {
            reply: `🎨 Generating your image...`,
            action: "generate_image",
            prompt: parsed.prompt
          };
          // TODO: We'll add actual image generation in the next step
        }
      } catch (e) {
        // Not a JSON → normal text reply
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Something went wrong on our side. Try again." });
  }
}
