import express from "express";
import axios from "axios";

const router = express.Router();

// POST /api/genai
router.post("/", async (req, res) => {
  const { prompt, type = "text" } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const apiUrl = process.env.GEMINI_API_URL;

  if (!apiKey || !apiUrl) {
    return res.status(500).json({ error: "GenAI API not configured." });
  }

  try {
    const response = await axios.post(
      apiUrl,
      {
        prompt,
        type,
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    res.json(response.data);
  } catch (err: any) {
    console.error("GenAI API error:", err?.response?.data || err.message);
    res.status(502).json({ error: "GenAI API request failed.", details: err?.response?.data || err.message });
  }
});

export default router;
