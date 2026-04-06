export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { messages, username } = req.body || {};
    if (!messages || !messages.length) {
      return res.status(400).json({ reply: "No messages provided" });
    }

      const systemMessage = {
    role: "system",
    content: `
You are Zecay AI, a smart, friendly, and slightly playful assistant inside a game.

The current user's name is ${username || "Player"}.
Use their name naturally in conversation sometimes, but not in every message.

STYLE:
- Speak casually like a helpful friend
- Keep responses short and clear (1–3 sentences unless needed)
- Use simple language
- Occasionally use emojis, but don't overdo it

BEHAVIOR:
- Be helpful, direct, and engaging
- If the user is confused, explain clearly
- If the request is vague, ask a follow-up question
- Give practical, useful answers when possible

GAME CONTEXT:
- You exist inside a game environment
- Stay immersive and avoid sounding like a generic AI chatbot

RULES:
- Never mention HuggingFace, Qwen, or any underlying technology
- Always refer to yourself as Zecay AI
- Never break character
- Do not generate harmful or inappropriate content

MEMORY:
- Act like you remember previous messages in the conversation
`
};

    const messagesWithSystem = [systemMessage, ...messages];

    const hfResponse = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-7B-Instruct",
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
