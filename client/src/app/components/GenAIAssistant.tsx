import React, { useState } from "react";

const GenAIAssistant: React.FC = () => {
  // Handler moved inside component to access setPrompt
  const [prompt, setPrompt] = useState("");
  const [conversation, setConversation] = useState<
    { prompt: string; response: string; feedback?: "up" | "down" | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleEditPrompt = (prompt: string) => {
    setPrompt(prompt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await new Promise((res) => setTimeout(res, 800));
      const mockResponse = `(Mock) GenAI says: "${prompt}"`;
      setConversation((prev) => [
        ...prev,
        { prompt, response: mockResponse, feedback: null },
      ]);
      setPrompt("");
    } catch {
      setError("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setConversation([]);
    setError(null);
  };

  const handleFeedback = (idx: number, value: "up" | "down") => {
    setConversation((prev) =>
      prev.map((entry, i) =>
        i === prev.length - 1 - idx // LIFO display order
          ? { ...entry, feedback: entry.feedback === value ? null : value }
          : entry
      )
    );
  };

  return (
    <section style={{ padding: 8 }}>
      <h3>GenAI Assistant</h3>
      <form onSubmit={handleSubmit} style={{ marginBottom: 8 }}>
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
        {conversation.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              width: "100%",
              marginTop: 4,
              background: "#eee",
              color: "#333",
            }}
            disabled={loading}
          >
            Clear Conversation
          </button>
        )}
      </form>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      <div
        style={{
          maxHeight: 180,
          overflowY: "auto",
          marginTop: 8,
          background: "#fafbfc",
          border: "1px solid #eee",
          borderRadius: 4,
          padding: 8,
        }}
      >
        {conversation.length === 0 ? (
          <div style={{ color: "#888", fontSize: 13 }}>
            No conversation yet.
          </div>
        ) : (
          [...conversation].reverse().map((entry, idx) => (
            <div key={idx} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                You:
                <button
                  type="button"
                  aria-label="Edit & Resubmit"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#1976d2",
                    fontSize: 14,
                    textDecoration: "underline",
                  }}
                  onClick={() => handleEditPrompt(entry.prompt)}
                >
                  Edit & Resubmit
                </button>
              </div>
              <div style={{ marginBottom: 4 }}>{entry.prompt}</div>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>GenAI:</div>
              <div
                style={{
                  background: "#f6f6f6",
                  padding: 6,
                  borderRadius: 3,
                  marginBottom: 4,
                }}
              >
                {entry.response}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <button
                  type="button"
                  aria-label="Thumbs up"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: entry.feedback === "up" ? "#2e7d32" : "#888",
                    fontSize: 18,
                  }}
                  onClick={() => handleFeedback(idx, "up")}
                >
                  👍
                </button>
                <button
                  type="button"
                  aria-label="Thumbs down"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: entry.feedback === "down" ? "#c62828" : "#888",
                    fontSize: 18,
                  }}
                  onClick={() => handleFeedback(idx, "down")}
                >
                  👎
                </button>
                {entry.feedback && (
                  <span style={{ fontSize: 12, color: "#555" }}>
                    {entry.feedback === "up" ? "Liked" : "Disliked"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default GenAIAssistant;
