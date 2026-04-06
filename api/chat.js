// pages/api/chat.js
import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  // ===== 1️⃣ CORS HEADERS (apply to all requests) =====
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") return res.status(200).end();
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

  // ===== 2️⃣ Only allow POST =====
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed. Use POST." });
  }

  try {
    // ===== 2️⃣ Extract body =====
    const { messages, username, aiTier, aiName, generateImage } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ reply: "No messages provided." });
    }

    // ===== 3️⃣ Determine model & tier info =====
    let textModel = "Qwen/Qwen2.5-7B-Instruct"; // default
    let tierInfo = "";
    const tier = aiTier || "default";

    if (tier === "go" || tier === "plus") {
      // BOTH GO AND PLUS USE SAME TEXT MODEL (better than default)
      textModel = "mistralai/Mistral-7B-Instruct-v0.2"; // FREE & BETTER
    }

    if (tier === "go") {
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Faster, smarter responses
- Better context
`;
    } else if (tier === "plus") {
      tierInfo = `
PLUS TIER:
- Unlimited memory
- Best quality responses
- Image generation support
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

    // ===== 4️⃣ Check if we need IMAGE GENERATION =====
    if (generateImage && tier === "plus") {
      console.log("🎨 Image generation requested for PLUS tier");
      
      const client = new InferenceClient(process.env.HF_TOKEN);
      
      // Get the user's last message as the image prompt
      const lastUserMessage = messages[messages.length - 1]?.content || "A beautiful landscape";
      
      try {
        const image = await client.textToImage({
          provider: "fal-ai",
          model: "Qwen/Qwen-Image-2512",
          inputs: lastUserMessage,
          parameters: { num_inference_steps: 5 },
        });

        // Convert Blob to base64
        const buffer = await image.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        
        return res.status(200).json({
          reply: `🎨 Image generated based on: "${lastUserMessage}"`,
          imageData: `data:image/png;base64,${base64Image}`,
          generateImageProcessed: true
        });
      } catch (imgError) {
        console.error("Image generation error:", imgError);
        return res.status(500).json({ 
          reply: "⚠️ Failed to generate image. Falling back to text response." 
        });
      }
    }

    // ===== 5️⃣ System prompt (USE aiName VARIABLE) =====
    const systemMessage = {
      role: "system",
      content: `
You are ${aiName || "AI Assistant"}, a friendly, slightly playful assistant inside a game.
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
- Never mention HuggingFace, Qwen, Mistral, or tech details
- Always call yourself ${aiName || "AI Assistant"}
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

    // ===== 8️⃣ HuggingFace TEXT API call =====
    const hfResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: textModel,
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
      generateImageProcessed: false
    });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
