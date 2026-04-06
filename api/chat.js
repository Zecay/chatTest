// pages/api/chat.js
export default async function handler(req, res) {
  // CORS Headers - improved for better compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle Preflight (OPTIONS) Request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const {
      messages,
      username,
      aiTier,
      aiName,
      generateImage = false,
      testImageMode = false
    } = req.body || {};

    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    // === EASY CONFIGURATION SECTION ===
    // Change these values whenever you want to update models (no other code changes needed)
    const DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct";
    const GO_MODEL = "GO_MODEL_PLACEHOLDER";        // ← change this for "go" tier
    const PLUS_MODEL = "PLUS_MODEL_PLACEHOLDER";    // ← change this for "plus" tier

    // Image generation model (Hugging Face FLUX)
    const IMAGE_MODEL_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";

    // Default values
    const tier = aiTier || "default";
    const botName = aiName || "Zecay AI";

    // Tier configuration (keeps your original Qwen setup)
    let model = DEFAULT_MODEL;
    let tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses compared to higher tiers
`;
    if (tier === "go") {
      model = GO_MODEL;
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Smarter and faster responses than default
- More contextual understanding
`;
    } else if (tier === "plus") {
      model = PLUS_MODEL;
      tierInfo = `
PLUS TIER:
- Unlimited memory (can recall entire conversation)
- Best response quality
- Image generation support enabled
- Highest intelligence and speed
`;
    }

    // System message (old working prompt + new image rules merged)
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, and slightly playful assistant inside a game.
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
- Always refer to yourself as ${botName}
- Never break character
- Do not generate harmful or inappropriate content

IMAGE RULES:
- There is a "Generate Image" button next to the send button.
- If user wants you to generate an image, tell them: "Please click the Generate Image button if you want me to create an image!"
- Only generate when generateImage=true (button was clicked).
- Never try to generate images in your normal text replies.

MEMORY:
- Act like you remember previous messages in the conversation

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
`
    };

    // Memory limits per tier (exactly as your old working script)
    let maxMemory = 10;
    if (tier === "go") maxMemory = 30;
    if (tier === "plus") maxMemory = messages.length;

    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

    // Call Hugging Face Router (exactly as your old working script)
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

    let result = { reply };

    // ================== IMAGE GENERATION (added from new script) ==================
    if (generateImage === true) {
      const canGenerateImage = testImageMode || tier === "plus";

      if (!canGenerateImage) {
        result = { reply: "Image generation is only available in Plus tier." };
      } else {
        const imagePrompt = messages[messages.length - 1]?.content || "A beautiful high-quality image";

        const imageRes = await fetch(
          IMAGE_MODEL_URL,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 20,
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
    console.error(error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
