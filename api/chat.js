export default async function handler(req, res) {
  // CORS Headers - MUST be at the very top
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle Preflight (OPTIONS) Request - Very Important
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const {
      messages
      username,
      aiTier,
      aiName,
      generateImage = false,
      testImageMode = false
    } = req.body || {};

    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    const tier = aiTier || "default";
    const botName = aiName || "Czarek AI";

    // ================== choose model ==================
    // These are the best 100% FREE models on OpenRouter right now (April 2026)
    // - "go" tier   → fast & reliable (slightly lighter)
    // - "plus" tier → noticeably smarter & higher quality
    let textModel = "openrouter/free"; // fallback smart router (also free)

    if (tier === "go") {
      textModel = "stepfun/step-3.5-flash:free";        // slightly worse but super fast & high usage
    } else if (tier === "plus") {
      textModel = "qwen/qwen3.6-plus:free";             // better one (currently one of the strongest free models)
    }

    const canGenerateImage = testImageMode || tier === "plus";

    // System prompt (kept exactly as you had it)
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly assistant in remix.gg.
Current user: ${username || "Player"}.
Speak casually and keep replies short.
Never mention models or technology.
IMAGE RULES:
- There is a "Generate Image" button next to the send button.
- If user wants image but didn't click the button, tell them: "Please click the Generate Image button if you want me to create an image!"
- Only generate when generateImage=true.
- When generating, reply with EXACT JSON only: {"action": "generate_image", "prompt": "detailed prompt here"}
AI TIER: ${tier.toUpperCase()}
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const messagesWithSystem = [systemMessage, ...messages.slice(-maxMemory)];

    // Call OpenRouter for text response
    const textResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://remix.gg",
        "X-Title": "Czarek AI",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: textModel,
        messages: messagesWithSystem,
        max_tokens: 600,
        temperature: 0.75
      })
    });

    const data = await textResponse.json();

    // Better error handling (no more confusing messages)
    if (!textResponse.ok || data.error) {
      console.error("OpenRouter API error:", {
        status: textResponse.status,
        error: data.error || data
      });

      return res.status(200).json({
        reply: "Sorry, the AI is taking a nap right now 😴 Try again in a few seconds."
      });
    }

    let reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I got stuck...";
    let result = { reply };

    // ================== IMAGE GENERATION ==================
    if (generateImage === true) {
      if (!canGenerateImage) {
        result = { reply: "Image generation is only available in Plus tier." };
      } else {
        const imagePrompt = messages[messages.length - 1]?.content || "A beautiful high-quality image";

        const imageRes = await fetch(
          "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 20,      // faster & still great quality
                guidance_scale: 3.5,
                width: 1024,
                height: 1024
              }
            })
          }
        );

        if (imageRes.ok) {
          const buffer = await imageRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const imageUrl = `data:image/png;base64,${base64}`;

          result = {
            reply: `🎨 Here's your image!`,
            imageUrl: imageUrl,
            action: "generated_image"
          };
        } else {
          result = { reply: "Failed to generate image. Try again." };
        }
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
