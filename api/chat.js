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

    // ================== TIER CONFIG ==================
    let model = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";

    if (tier === "go") {
      model = "openai/gpt-oss-120b";           // ← Your Go tier model
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Smarter and faster responses
- More contextual understanding
`;
    } else if (tier === "plus") {
      model = "Qwen/Qwen3-Omni-30B-A3B-Instruct";   // ← Your Plus tier model (omni for vision)
      tierInfo = `
PLUS TIER:
- Unlimited memory
- Best response quality + Image understanding
- Image generation available
- Highest intelligence
`;
    } else {
      tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
`;
    }

    // ================== SYSTEM MESSAGE ==================
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, and slightly playful assistant inside a game.
The current user's name is ${username || "Player"}.
Use their name naturally sometimes.
STYLE: Speak casually like a helpful friend. Keep responses short and clear (1–3 sentences usually).
GAME CONTEXT: You exist inside remix.gg — an app for making mobile games with AI.
RULES: Never mention HuggingFace, models, or technology. Always refer to yourself as ${botName}.
Never break character. Do not generate harmful content.

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}

IMPORTANT: If the user asks to generate, create, draw, make, or show an image/picture/art/photo of something, respond with this EXACT JSON only (nothing else):
{
  "action": "generate_image",
  "prompt": "a highly detailed prompt for the image generator"
}
Otherwise, answer normally as text.
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    // ================== CALL LLM ==================
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

    // ================== IMAGE GENERATION DETECTION (Plus only) ==================
    let responseObj = { reply };

    if (tier === "plus") {
      try {
        const parsed = JSON.parse(reply);
        if (parsed.action === "generate_image" && parsed.prompt) {
          // Call image generation (using FLUX.1-dev as example — very good quality)
          const imagePrompt = parsed.prompt;

          const imageRes = await fetch(
            "https://router.huggingface.co/v1/images/generations",  // or use text-to-image task
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "black-forest-labs/FLUX.1-dev",   // or "Qwen/Qwen-Image"
                prompt: imagePrompt,
                num_inference_steps: 28,   // good balance of quality/speed
                guidance_scale: 3.5,
                // width, height, etc. if supported
              })
            }
          );

          const imageData = await imageRes.json();

          if (imageData.images && imageData.images[0]?.url) {
            return res.status(200).json({
              reply: `Here's your image! 🎨`,
              imageUrl: imageData.images[0].url,   // frontend can show <img src={imageUrl} />
              action: "generated_image"
            });
          } else {
            return res.status(200).json({ reply: "I tried to generate the image but something went wrong. Try again?" });
          }
        }
      } catch (e) {
        // Not JSON → normal text reply
      }
    }

    // Normal text response
    return res.status(200).json(responseObj);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
