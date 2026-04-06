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

    // Default values
    const tier = aiTier || "default";
    const botName = aiName || "Zecay AI";

    // Tier configuration
    let model = "Qwen/Qwen2.5-7B-Instruct";
    let tierInfo = "";

    if (tier === "go") {
      model = "GO_MODEL_PLACEHOLDER"; // <-- replace later
      tierInfo = `
GO TIER:
- Can remember up to 30 past messages
- Smarter and faster responses than default
- More contextual understanding
`;
    } else if (tier === "plus") {
      model = "PLUS_MODEL_PLACEHOLDER"; // <-- replace later
      tierInfo = `
PLUS TIER:
- Unlimited memory (can recall entire conversation)
- Best response quality
- Image understanding support enabled
- Highest intelligence and speed
`;
    } else {
      tierInfo = `
DEFAULT TIER:
- Can remember up to 10 past messages
- Standard intelligence
- Slower responses compared to higher tiers
`;
    }

    // System message
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

MEMORY:
- Act like you remember previous messages in the conversation

AI TIER ACTIVE: ${tier.toUpperCase()}
${tierInfo}
`
    };

    // Memory limits per tier
    let maxMemory = 10;
    if (tier === "go") maxMemory = 30;
    if (tier === "plus") maxMemory = messages.length;

    const trimmedMessages = messages.slice(-maxMemory);
    const messagesWithSystem = [systemMessage, ...trimmedMessages];

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

    return res.status(200).json({ reply });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
