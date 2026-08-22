import { useState } from "react";
import { api } from "../api/client";
import type { AssistantResponse } from "../api/types";
import { ProposalCard } from "../components/ProposalCard";
import { useParty } from "../context/PartyContext";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; response: AssistantResponse };

interface Props {
  onViewInCatalog: (opKey: string) => void;
}

export function Assistant({ onViewInCatalog }: Props) {
  const { activePartyId } = useParty();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      response: {
        matched: false,
        message:
          'Tell me what you want to do -- e.g. "create a new current account for party 2622649730" ' +
          'or "block funds on an account". I\'ll find the matching API and show you exactly what ' +
          "I'm about to call before anything actually fires.",
      },
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setSending(true);
    try {
      const response = await api.assistantQuery(text, activePartyId);
      setMessages((m) => [...m, { role: "assistant", response }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          response: { matched: false, message: e instanceof Error ? e.message : String(e) },
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="assistant-layout">
      <div className="chat-scroll">
        {messages.map((m, i) => (
          <div className={`chat-msg ${m.role}`} key={i}>
            {m.role === "user" ? (
              <div className="chat-bubble">{m.text}</div>
            ) : m.response.matched ? (
              <ProposalCard initial={m.response} onViewInCatalog={onViewInCatalog} />
            ) : (
              <div className="chat-bubble">
                {m.response.message}
                {m.response.candidates && m.response.candidates.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    Closest matches in the catalog:
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {m.response.candidates.slice(0, 5).map((c) => (
                        <li key={c.opKey}>
                          <span className={`method-badge ${c.method}`} style={{ marginRight: 6 }}>
                            {c.method}
                          </span>
                          {c.summary}
                          <span style={{ opacity: 0.6 }}>
                            {" "}
                            — {c.service} · {c.tags[0] || "General"}
                          </span>{" "}
                          <button
                            className="link-btn"
                            onClick={() => onViewInCatalog(c.opKey)}
                            title="Open this operation in the Catalog tab"
                          >
                            View in Catalog →
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="chat-msg assistant">
            <div className="chat-bubble">
              <span className="spinner" />
            </div>
          </div>
        )}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="I want to..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn btn-primary" onClick={send} disabled={sending}>
          Send
        </button>
      </div>
    </div>
  );
}
