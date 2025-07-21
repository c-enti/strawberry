import React, { useState } from "react";

const GenAIAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      await new Promise((res) => setTimeout(res, 800));
      setResponse(`(Mock) GenAI says: "${prompt}"`);
    } catch {
      setError("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ padding: 8 }}>
      <h3>GenAI Assistant</h3>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your calendar vision or ask for ideas..."
          rows={2}
          style={{ width: "100%", marginBottom: 8 }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          style={{ width: "100%" }}
        >
          {loading ? "Thinking..." : "Ask GenAI"}
        </button>
      </form>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      {response && (
        <div
          style={{
            marginTop: 12,
            background: "#f6f6f6",
            padding: 8,
            borderRadius: 4,
          }}
        >
          <strong>GenAI:</strong> {response}
        </div>
      )}
    </section>
  );
};

export default GenAIAssistant;
