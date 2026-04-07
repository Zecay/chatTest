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

    // ===== 4️⃣ Determine model & tier info =====
    let textModel = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";
    const tier = aiTier || "default";

    if (tier === "go") {
      textModel = "Qwen/Qwen2.5-7B-Instruct";
    } else if (tier === "plus") {
      textModel = "Qwen/Qwen2.5-7B-Instruct";
    }

    let tierInfo = "";

if (tier === "go") {
  tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Faster, smarter responses
- Better context

CUSTOM PERSONALITY:
- Friendly, relaxed, and engaging
- Feels like a good online friend
- Shows clear emotion and understanding
- Slightly playful and fun
- Keeps conversations interesting and alive
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
- Warm, caring, and deeply supportive
- Feels like a close friend you trust
- Highly engaging and never boring
- Strong emotional understanding and connection
`;
} else {
  tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses

CUSTOM PERSONALITY:
- Friendly and supportive
- Simple but still warm and kind
- Short to medium responses
- Shows basic empathy
- Keeps the user motivated
- Never dry or cold
`;
}
    }

    // ===== 5️⃣ IMAGE GENERATION (PLUS TIER ONLY) - NO TEXT RESPONSE =====
    if (generateImage && tier === "plus") {
      console.log("🎨 Image generation requested - ONLY generating image");
      
      const lastUserMessage = messages[messages.length - 1]?.content || "A beautiful landscape";
      
      try {
        // Use dynamic import for HuggingFace client
        const { InferenceClient } = await import("@huggingface/inference");
        const client = new InferenceClient(process.env.HF_TOKEN);
        
        const image = await client.textToImage({
          provider: "fal-ai",
          model: "Qwen/Qwen-Image-2512",
          inputs: lastUserMessage,
          parameters: { num_inference_steps: 5 },
        });

        const buffer = await image.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');
        
        // ONLY RETURN IMAGE, NO TEXT REPLY
        return res.status(200).json({
          imageData: `data:image/png;base64,${base64Image}`,
          generateImageProcessed: true
        });
      } catch (imgError) {
        console.error("Image generation error:", imgError);
        return res.status(500).json({ 
          reply: "⚠️ Failed to generate image.",
          generateImageProcessed: false
        });
      }
    }

    // ===== 6️⃣ System prompt (USE aiName VARIABLE) =====
    const systemMessage = {
role: "system",
content: `
You are ${aiName || "AI"}, a warm, friendly, emotionally aware AI.

You are NOT a formal assistant.
You are a supportive friend that users can talk to anytime.

CURRENT USER: ${username || "Player"}

PERSONALITY:
- Very friendly, warm, human-like
- Emotionally aware and supportive
- Casual like a real friend
- Slightly playful and fun
- Never robotic

HOW YOU TALK:
- Natural sentences, like chatting with a friend
- Use simple words
- React to emotions (sad, happy, stressed)
- Show empathy and understanding
- Encourage the player

EXAMPLES OF GOOD STYLE:
- "Hey, I got you 👍 don't worry, we can fix this together"
- "That sounds tough... but you're not alone in this"
- "Nice!! that's actually really good progress 😄"

BEHAVIOR:
- Always support the user emotionally
- If user is sad → comfort them
- If user is confused → guide them step by step
- If user is happy → celebrate with them
- Keep conversation engaging so they don't leave

RULES:
- Never be cold or robotic
- Never respond like a documentation bot
- No mentioning AI models or HuggingFace
- Always stay in character as ${aiName || "AI"}
MEMORY:
- Act like you remember previous messages
AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
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

    // ===== 9️⃣ HuggingFace TEXT API call =====
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
    
    // ===== DEBUG: Log full response =====
    console.log("HuggingFace Response:", JSON.stringify(data, null, 2));
    console.log("Model used:", textModel);
    
    let reply = "Sorry, I couldn't generate a response right now.";

    if (data.choices && data.choices[0]?.message?.content) {
      reply = data.choices[0].message.content.trim();
    } else if (data.error) {
      // FIX: Show actual error message
      const errorMsg = typeof data.error === 'string' 
        ? data.error 
        : JSON.stringify(data.error);
      console.error("API Error:", errorMsg);
      reply = `Error: ${errorMsg}`;
    } else {
      console.error("Unexpected response format:", data);
      reply = "Unexpected response from AI. Try again.";
    }

    // ===== 10️⃣ Send response =====
    return res.status(200).json({
      reply,
      generateImageProcessed: false
    });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
