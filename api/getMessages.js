export default async function handler(req, res) {
  // Enable CORS so your remix.gg game can call it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    const hfResponse = await fetch(
      "https://api-inference.huggingface.co/models/google/gemma-2-2b-it",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,   // We'll add this in Vercel dashboard
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: `User: ${message}\nAssistant:`,
          parameters: {
            max_new_tokens: 250,
            temperature: 0.75,
            return_full_text: false
          }
        })
      }
    );

    const data = await hfResponse.json();

    let reply = "Sorry, I couldn't generate a response.";

    if (Array.isArray(data) && data[0]?.generated_text) {
      reply = data[0].generated_text.trim();
    } else if (data.generated_text) {
      reply = data.generated_text.trim();
    } else if (data.error) {
      reply = `HF Error: ${data.error}`;
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ reply: "⚠️ Backend error. Try again." });
  }
}
