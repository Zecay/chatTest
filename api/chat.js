export default async function handler(req, res) {
  // === IMPROVED CORS HANDLING ===
  res.setHeader('Access-Control-Allow-Origin', '*');           // Change to 'https://remix.gg' later for security
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');   // Add this

  // Handle preflight OPTIONS request immediately
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const {
      messages,
      username,
      aiTier,
      aiName,
      generateImage = false,     // From "Generate Image" button
      testImageMode = false      // Set to true during testing (allows all tiers)
    } = req.body || {};

    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    const tier = aiTier || "default";
    const botName = aiName || "Czarek AI";

    // ================== TEXT MODEL (OpenRouter Free) ==================
    let textModel = "qwen/qwen2.5-7b-instruct:free";

    if (tier === "go") {
      textModel = "meta-llama/llama-3.3-70b-instruct:free";
    } else if (tier === "plus") {
      textModel = "qwen/qwen3.6-plus:free";
    }

    const canGenerateImage = testImageMode || tier === "plus";

    const tierInfo = tier === "go"
      ? "GO TIER: Smarter & faster, remembers up to 30 messages."
      : tier === "plus"
      ? "PLUS TIER: Best quality + Image generation enabled."
      : "DEFAULT TIER: Standard responses.";

    // ================== SYSTEM MESSAGE ==================
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, slightly playful assistant in remix.gg.
Current user: ${username || "Player"}.
Speak casually like a helpful friend. Keep most replies short and clear (1-3 sentences).
Never mention models, OpenRouter, or technology.

IMAGE RULES:
- There is a "Generate Image" button next to the send button.
- If the user wants an image but did NOT click the Generate Image button, politely say: "Click the Generate Image button next to the send button if you want me to create an image!"
- Only generate an image when generateImage=true is sent.
- When generating an image, reply with EXACT JSON only: {"action": "generate_image", "prompt": "very detailed prompt here"}

AI TIER: ${tier.toUpperCase()} — ${tierInfo}
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const messagesWithSystem = [systemMessage, ...messages.slice(-maxMemory)];

    // ================== CALL TEXT AI ==================
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

    if (!textResponse.ok || data.error) {
      console.error("Text AI Error:", data);
      return res.status(200).json({
        reply: `⚠️ AI is busy right now. Wait 10 seconds and try again.`
      });
    }

    let reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I got stuck...";

    // ================== IMAGE GENERATION LOGIC ==================
    let result = { reply };

    if (generateImage === true) {
      if (!canGenerateImage) {
        result = {
          reply: "Image generation is only available in **Plus tier** for now. Turn on test mode or upgrade!"
        };
      } else {
        // Use the last user message as the image prompt
        const lastUserMessage = messages[messages.length - 1]?.content || "A beautiful high-quality image";
        const imagePrompt = typeof lastUserMessage === "string" ? lastUserMessage : lastUserMessage;

        // Call Qwen-Image-2512
        const imageRes = await fetch(
          "https://api-inference.huggingface.co/models/Qwen/Qwen-Image-2512",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 35,
                guidance_scale: 4.5,
                width: 1024,
                height: 1024,
                seed: Math.floor(Math.random() * 1000000)   // random seed
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
          const errorText = await imageRes.text().catch(() => "Unknown error");
          console.error("Image Gen Error:", errorText);
          result = { reply: "Failed to generate the image. The server might be busy — try again in a few seconds." };
        }
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const { 
      messages, 
      username, 
      aiTier, 
      aiName, 
      generateImage = false,   // New: from frontend button
      testImageMode = false    // New: testing mode (set true to allow all tiers)
    } = req.body || {};

    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

    const tier = aiTier || "default";
    const botName = aiName || "Zecay AI";

    // ================== TEXT MODEL (OpenRouter Free) ==================
    let textModel = "qwen/qwen2.5-7b-instruct:free";

    if (tier === "go") {
      textModel = "meta-llama/llama-3.3-70b-instruct:free";
    } else if (tier === "plus") {
      textModel = "qwen/qwen3.6-plus:free";
    }

    const canGenerateImage = testImageMode || tier === "plus";

    const tierInfo = tier === "go" 
      ? "GO TIER: Smarter & faster, remembers up to 30 messages."
      : tier === "plus"
      ? "PLUS TIER: Best quality + Image generation enabled."
      : "DEFAULT TIER: Standard responses.";

    // ================== SYSTEM MESSAGE ==================
    const systemMessage = {
      role: "system",
      content: `
You are ${botName}, a smart, friendly, slightly playful assistant in remix.gg.
Current user: ${username || "Player"}.
Speak casually, keep replies short (1-3 sentences usually).
Never mention models or technology.

IMAGE GENERATION RULES:
- There is a "Generate Image" button next to the send button.
- If the user wants an image but did NOT click the Generate Image button (generateImage=false), tell them politely: "Click the Generate Image button next to the send button if you want me to create an image!"
- Only generate an image when generateImage=true.
- When generating, reply with EXACT JSON only: {"action": "generate_image", "prompt": "very detailed prompt here"}

AI TIER: ${tier.toUpperCase()} — ${tierInfo}
`
    };

    const maxMemory = tier === "plus" ? messages.length : (tier === "go" ? 30 : 10);
    const messagesWithSystem = [systemMessage, ...messages.slice(-maxMemory)];

    // ================== CALL TEXT AI ==================
    const textResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://remix.gg",
        "X-Title": "Zecay AI",
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

    if (!textResponse.ok || data.error) {
      console.error("Text AI Error:", data);
      return res.status(200).json({ 
        reply: `⚠️ AI is busy. Wait a few seconds and try again.` 
      });
    }

    let reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I got stuck...";

    // ================== IMAGE GENERATION LOGIC ==================
    let result = { reply };

    // If frontend explicitly wants image (button clicked)
    if (generateImage === true) {
      if (!canGenerateImage) {
        result = { 
          reply: "Image generation is only available in **Plus tier** right now. Upgrade or turn on test mode!" 
        };
      } else {
        // Extract prompt from last user message
        const lastUserMessage = messages[messages.length - 1]?.content || reply;
        const imagePrompt = typeof lastUserMessage === 'string' 
          ? lastUserMessage 
          : "A beautiful high quality image, detailed, cinematic";

        // Call Qwen-Image-2512
        const imageRes = await fetch(
          "https://api-inference.huggingface.co/models/Qwen/Qwen-Image-2512",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 30,
                guidance_scale: 4.0,
                width: 1024,
                height: 1024
              }
            })
          }
        );

        if (imageRes.ok) {
          const buffer = await imageRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
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
    // If user mentioned image but didn't click button
    else if (reply.includes("generate_image") || reply.toLowerCase().includes("click the generate image button")) {
      // Let the AI's instruction go through
      result = { reply };
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
