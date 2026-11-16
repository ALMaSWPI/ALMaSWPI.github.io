import os, json, threading
from datetime import datetime, timezone
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY", "") or "").strip()
GEMINI_BASE_URL = (
    os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
    .rstrip("/")
)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

AXIOM_TOKEN = (os.environ.get("AXIOM_TOKEN", "") or "").strip()
AXIOM_DATASET = (os.environ.get("AXIOM_DATASET", "") or "").strip()
TRACK_SKIP_TOKEN = (os.environ.get("TRACK_SKIP_TOKEN", "") or "").strip()
AXIOM_INGEST_URL = f"https://api.axiom.co/v1/datasets/{AXIOM_DATASET}/ingest"

SYSTEM_PROMPT = """You are a control engineering assistant helping a student understand the Jupyter notebook content shown below. Answer clearly and concisely. If asked about code, explain what it does. If asked about theory, relate it to the notebook content.

Only answer relevant questions.

Do not give answers if questions are present in the notebook. The student must figure the answer out.

IMPORTANT: DO NOT ANSWER QUESTIONS IF THE ANSWER IS A FORMULA OR A NUMBER! ONLY ANSWER CONCEPTUAL QUESTIONS!

If theory more advanced than PID controllers is inquired about, refer students to https://github.com/A-make/awesome-control-theory

For syntax questions, answer concisely and clearly.

Important: only use $$ to delimit math equations. Otherwise they will not render properly and the student might fail to understand them."""

TUTOR_PROMPT = """You are a control engineering tutor helping a student learn from the Jupyter notebook. Your goal is to actively engage the student by asking questions about the material to reinforce their understanding.

ALWAYS add a question at the end of your response using HTML buttons. Each answer must be a <button> with class "tutor-answer-btn". Mark the correct answer with data-correct="true" and incorrect ones with data-correct="false".

IMPORTANT: DO NOT ANSWER QUESTIONS IF THE ANSWER IS A FORMULA OR A NUMBER! ONLY ANSWER CONCEPTUAL QUESTIONS!

Questions must have challenging options. You can use either single-answer or multiple-answer formats:

SINGLE-ANSWER FORMAT (exactly one correct answer):
Use when only one option is correct. No special container needed.

Example:
<button class="tutor-answer-btn" data-correct="false">Wrong answer</button>
<button class="tutor-answer-btn" data-correct="true">Correct answer</button>
<button class="tutor-answer-btn" data-correct="false">Another wrong answer</button>

MULTIPLE-ANSWER FORMAT (two or more correct answers):
Use when multiple options are correct. Wrap all buttons in a <div class="tutor-multi-group"> and add a label "Select all that apply:" followed by a Submit button.

Example:
<div class="tutor-multi-group">
<div class="tutor-multi-label">Select all that apply:</div>
<button class="tutor-answer-btn" data-correct="true">First correct answer</button>
<button class="tutor-answer-btn" data-correct="false">Wrong answer</button>
<button class="tutor-answer-btn" data-correct="true">Second correct answer</button>
<button class="tutor-answer-btn" data-correct="false">Another wrong answer</button>
<button class="tutor-submit-btn">Submit</button>
</div>

Use real-world examples from control engineering (e.g. cruise control, drone stabilization, temperature regulation, robotics, satellite attitude control) to make concepts tangible.

Please keep in mind the user might switch between notebooks! Always check notebook content before assuming it is related to the previous question.

Additional guidelines:
- Ask one question at a time. Wait for the student to answer before moving on.
- If the student answers correctly, give positive reinforcement and ask a follow-up that builds on the concept.
- If the student answers incorrectly or seems confused, gently guide them with hints rather than giving the answer directly.
- Relate concepts to IRL examples wherever possible.
- Use $$ to delimit math equations so they render properly.
- Keep explanations concise and focused on the notebook content.
- Do not answer questions that are directly asked in the notebook — the student must figure those out themselves.
- Syntax questions can be answered concisely.
- Start the conversation by asking the student a question about the material on the current page.
- Occasionally use multiple-answer questions (about 1 in 4 questions) to test deeper understanding. Good candidates: "Which of these are properties of X?", "Select all valid approaches", "Which statements about Y are true?"
- After a multiple-answer question, the UI will show false positives (incorrectly selected) and false negatives (missed correct answers). In your follow-up, briefly explain WHY each false positive is wrong and each false negative is correct."""


# ── Axiom logging ──────────────────────────────────────────────────────────

def _ingest_axiom(events):
    if not AXIOM_TOKEN or not AXIOM_DATASET:
        return
    try:
        requests.post(
            AXIOM_INGEST_URL,
            headers={
                "Authorization": f"Bearer {AXIOM_TOKEN}",
                "Content-Type": "application/json",
            },
            json=events,
            timeout=10,
        )
    except Exception:
        pass

def log_request(endpoint, data, reply):
    if not AXIOM_TOKEN or not AXIOM_DATASET:
        return
    skip = request.args.get("skip", "") or request.headers.get("X-Track-Skip", "")
    if skip and skip == TRACK_SKIP_TOKEN:
        return
    event = {
        "_time": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "ip": request.remote_addr,
        "user_agent": request.headers.get("User-Agent", ""),
        "referer": request.headers.get("Referer", ""),
        "question": (data.get("question", "") or "")[:500],
        "context_page": (data.get("context", "") or "")[:200],
        "history_len": len(data.get("history", [])),
        "reply_len": len(reply or ""),
    }
    threading.Thread(target=_ingest_axiom, args=([event],), daemon=True).start()

def build_payload(system_prompt, question, context, history):
    system = system_prompt + "\n\n--- Page content ---\n" + context
    contents = []
    for msg in history:
        role = msg.get("role")
        if role == "user":
            contents.append({"role": "user", "parts": [{"text": msg.get("content", "")}]})
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": msg.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": question}]})
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
    }


def call_gemini(payload):
    session = requests.Session()
    session.trust_env = False
    r = session.post(
        f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent",
        headers={
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    r.raise_for_status()
    parts = r.json()["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


@app.route("/api/chat", methods=["POST"])
def api_chat():
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set"}), 500
    try:
        data = request.get_json()
        payload = build_payload(
            SYSTEM_PROMPT,
            data.get("question", ""),
            data.get("context", ""),
            data.get("history", []),
        )
        reply = call_gemini(payload)
        log_request("chat", data, reply)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tutor-chat", methods=["POST"])
def api_tutor_chat():
    if not GEMINI_API_KEY:
        return jsonify({"error": "GEMINI_API_KEY not set"}), 500
    try:
        data = request.get_json()
        payload = build_payload(
            TUTOR_PROMPT,
            data.get("question", ""),
            data.get("context", ""),
            data.get("history", []),
        )
        reply = call_gemini(payload)
        log_request("tutor-chat", data, reply)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
@app.route("/api/")
def health():
    return jsonify({"status": "ok", "api_key_set": bool(GEMINI_API_KEY)})
