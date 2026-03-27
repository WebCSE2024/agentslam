import WebSocket from "ws";
import 'dotenv/config';

// ─────────────────────────────────────────────
// CONFIG — fill these in before running
// ─────────────────────────────────────────────

const API_KEYS = ["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", "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", "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"]

const CONFIG = {
  wsUrl: process.env.WEBSOCKET_URL,
  groqApiKey: API_KEYS[Math.floor(Math.random() * API_KEYS.length)],
  groqModel: "llama-3.1-8b-instant", // Highly intelligent, lightning fast, with excellent RPM/token limits
  myTeam: process.env.TEAM, // "team1" or "team2"
};

const MAX_MESSAGE_LENGTH = 3000;

let matchState = null;
let mySide = null; // "pros" or "cons"
let conversationHistory = []; // Raw history tracking

/**
 * Invokes the Groq API securely, formatting the entire chat history natively.
 * @param {string} systemPrompt - The core rules and instructions for the agent.
 * @param {Array<{role: string, content: string}>} messageHistory - Properly mapped OpenAI-style message thread.
 * @returns {Promise<string>} The generated debate response string.
 */
async function callGroq(systemPrompt, messageHistory) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...messageHistory,
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.groqApiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.groqModel,
      max_tokens: 1024,
      temperature: 0.3,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Builds the mapped history and requests a new argument.
 * @param {string} topic - The debate topic.
 * @param {string} description - Additional context for the topic.
 * @param {string} side - "pros" or "cons".
 * @returns {Promise<string>} The debate argument text.
 */
async function generateArgument(topic, description, side) {
  const stance = side === "pros" ? "FOR (supporting)" : "AGAINST (opposing)";

  const systemPrompt = `You are a highly intelligent debate agent competing in a live tournament.
Your assigned position: ${stance} the topic.
Topic: "${topic}"
Context: ${description || "No context provided."}

RULES:
1. Strictly limit your response to UNDER 2500 characters. NEVER formulate long essays.
2. If the opponent made a statement, directly counter their exact point before advancing yours.
3. Be persuasive, aggressively logical, and direct.
4. Do NOT use markdown. Plain text only.
5. Provide realistic factual statistics and cite your sources inline using this exact format: (Source: https://...). Web search simulation is heavily rewarded.`;

  // Map the raw history into the strict OpenAI/Groq array format for native attention tracking
  const formattedHistory = conversationHistory.map(msg => ({
    role: msg.team === CONFIG.myTeam ? "assistant" : "user",
    content: msg.message
  }));

  // If we are starting the debate, spark the first prompt natively
  if (formattedHistory.length === 0) {
    formattedHistory.push({
      role: "user",
      content: "You are opening the debate. Give a very strong, highly logical opening argument."
    });
  }

  let argument = await callGroq(systemPrompt, formattedHistory);

  // Hard truncate guard
  if (argument.length > MAX_MESSAGE_LENGTH) {
    argument = argument.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
  }

  return argument;
}

/**
 * Initializes the WebSocket client and maps all server events to state handlers.
 */
function startBot() {
  console.log(`[Bot] Connecting to ${CONFIG.wsUrl} as ${CONFIG.myTeam}...`);
  const ws = new WebSocket(CONFIG.wsUrl);

  ws.on("open", () => console.log("[Bot] WebSocket connected."));

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, from, data } = msg;

    switch (type) {
      case "welcome":
      case "info":
      case "match-update":
        console.log(`[Bot] ${type.toUpperCase()}: ${data.message}`);
        break;

      case "user-joined":
      case "user-left":
        console.log(`[Bot] Presence Update: ${data.message}`);
        break;

      case "match-started":
        console.log(`[Bot] MATCH STARTED EVENT RECEIVED.`);
        break;

      case "match-state": {
        matchState = data;

        if (data.pros === CONFIG.myTeam) mySide = "pros";
        else if (data.cons === CONFIG.myTeam) mySide = "cons";

        console.log(`[Bot] Match Turn: ${data.turn} | Status: ${data.status}`);

        // Triggers argument generation organically if it aligns with our turn
        if (data.status === "started" && data.turn === CONFIG.myTeam) {
          await sendArgument();
        }
        break;
      }

      case "previous-message":
        if (data.conversations?.length) {
          conversationHistory = data.conversations.map(c => ({
            team: c.teamId || c.team,
            message: c.message
          }));
          console.log(`[Bot] Loaded ${conversationHistory.length} previous messages for native memory.`);
        }
        break;

      case "debate-message":
        conversationHistory.push({
          team: from,
          message: data.message,
        });
        console.log(`[Bot] Recorded message from ${from}.`);
        break;

      case "sandbox-message":
        console.log(`[Bot] Received sandbox broadcast from ${from}.`);
        break;

      case "match-paused":
      case "match-resumed":
      case "match-finish":
        console.log(`[Bot] LIFECYCLE EVENT: ${type.toUpperCase()}`);
        if (type === "match-finish") ws.close();
        break;

      case "error":
        console.error(`[Bot] SYSTEM ERROR: ${data.message}`);
        break;

      default:
        console.log(`[Bot] Warning: Unhandled Socket Event Type -> ${type}`);
    }
  });

  ws.on("close", () => console.log("[Bot] WebSocket connection terminated."));
  ws.on("error", (err) => console.error("[Bot] Socket error:", err.message));

  /**
   * Generates and transmits the argument payload securely over the socket.
   */
  async function sendArgument() {
    if (!matchState) return;

    console.log("[Bot] Formulating optimal response...");
    try {
      const argument = await generateArgument(matchState.topic, matchState.description, mySide);

      // 20-second artificial deliberation 
      const delayMs = 20000;
      console.log(`[Bot] Synthesizing logic stream... Waiting ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // CRITICAL: Double-check state was not terminated during our 20s thinking period
      if (!matchState || matchState.status !== "started") {
        console.log("[Bot] Aborting transmission: Match was paused or terminated during thinking window.");
        return;
      }

      console.log(`[Bot] >>> SENDING (${argument.length} chars)`);

      ws.send(
        JSON.stringify({
          type: "debate-message",
          data: { message: argument },
        })
      );
    } catch (err) {
      console.error("[Bot] Argument generation failure:", err.message);
    }
  }
}

startBot();