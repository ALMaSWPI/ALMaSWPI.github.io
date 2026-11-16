#!/usr/bin/env python3
"""
Freeze the combined ALMaSWPI + ES3011 JupyterLite site into static HTML
using Frozen-Flask, for deployment to GitHub Pages.

Usage:
    python freeze.py                        # builds to _build/
    python freeze.py serve                  # runs a dev server (API + static)
    API_BASE=https://my-api.example.com \
        python freeze.py                    # bakes API_BASE into frozen output
"""

import os, shutil, json
from flask import Flask, send_from_directory, abort, Response, request, jsonify
from flask_frozen import Freezer

HERE = os.path.dirname(os.path.abspath(__file__))

SITE_DIR = os.path.join(HERE, "es3011-content")
TEMPLATES_DIR = os.path.join(HERE, "templates")
STATIC_DIR = os.path.join(HERE, "static")

app = Flask(__name__, static_folder=None)
app.template_folder = TEMPLATES_DIR
app.config['FREEZER_DESTINATION'] = '_build'

ALMAS_DIR = HERE
# The course is published under the same path the legacy branch-based Pages
# site uses (/es3011-content/...), so links shared with students keep working.
# The fork repo uses "es3011" instead because its nav links there.
ES3011_PREFIX = "es3011-content"
SKIP_DIRS = {".git", "_build", "es3011-content", "templates", ".github"}

# ── API config ────────────────────────────────────────────────────────────

API_BASE = os.environ.get("API_BASE", "")

def load_env(path=".env"):
    envars = os.environ.copy()
    if os.path.isfile(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key, val = key.strip(), val.strip().strip("\"'")
                envars.setdefault(key, val)
    return envars

env = load_env(os.path.join(HERE, ".env"))
if not env.get("OPENCODE_API_KEY"):
    env = load_env(os.path.expanduser("~/JupyterBasedControlEngineeringTextbook/.env"))
ZEN_API_KEY = env.get("OPENCODE_API_KEY", "")
ZEN_BASE_URL = env.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
ZEN_MODEL = env.get("OPENCODE_MODEL", "big-pickle")

with open(os.path.join(STATIC_DIR, "system_prompt.txt")) as f:
    SYSTEM_PROMPT = f.read().strip()
with open(os.path.join(STATIC_DIR, "tutor_prompt.txt")) as f:
    TUTOR_PROMPT = f.read().strip()

# ── Injection templates ───────────────────────────────────────────────────

with open(os.path.join(TEMPLATES_DIR, "banner.html")) as f:
    BANNER_HTML = f.read()
with open(os.path.join(TEMPLATES_DIR, "ai_sidebar.html")) as f:
    AI_SIDEBAR_HTML = f.read()
with open(os.path.join(TEMPLATES_DIR, "tutor_bar.html")) as f:
    TUTOR_BAR_HTML = f.read()
with open(os.path.join(TEMPLATES_DIR, "settings_panel.html")) as f:
    SETTINGS_PANEL_HTML = f.read()


def relativize(html):
    """Rewrite /static/ paths to be relative to the current page depth."""
    depth = request.path.strip("/").count("/")
    if depth == 0:
        return html
    prefix = "../" * depth
    html = html.replace('href="/static/', f'href="{prefix}static/')
    html = html.replace('src="/static/', f'src="{prefix}static/')
    return html


def api_base_script():
    if not API_BASE:
        return ""
    return f'<script>window.API_BASE={json.dumps(API_BASE)};</script>\n'


def serve_with_banner(filepath):
    if not os.path.isfile(filepath):
        abort(404)
    with open(filepath) as f:
        content = f.read()

    banner = relativize(BANNER_HTML)
    ai = relativize(api_base_script() + AI_SIDEBAR_HTML)
    tutor = relativize(TUTOR_BAR_HTML)
    settings = relativize(SETTINGS_PANEL_HTML)
    # palette.css defines the --bg-*/--text-*/--border-* variables that every
    # menu stylesheet (banner, sidebar, tutor bar, settings) depends on;
    # without it all menu backgrounds render transparent.
    palette = relativize('<link rel="stylesheet" href="/static/css/palette.css">')
    hide_css = relativize('<link rel="stylesheet" href="/static/css/hide_code.css">')
    css = relativize('<link rel="stylesheet" href="/static/css/cell_tutor_links.css">')
    # hide_code.js must load before settings_panel.js (inside SETTINGS_PANEL_HTML)
    # so the toggles can read window.isCodeVisible / window.isAIVisible.
    hide_js = relativize('<script src="/static/hide_code.js"></script>')
    js = relativize('<script src="/static/cell_tutor_links.js"></script>')

    head = palette + hide_css + css
    tail = hide_js + ai + tutor + settings + js

    i = content.find("<body")
    if i >= 0:
        j = content.index(">", i) + 1
        content = content[:j] + banner + content[j:]
    if "</body>" in content:
        content = content.replace(
            "</body>",
            head + tail + "</body>",
        )
    else:
        content = content.replace(
            "</html>",
            head + tail + "\n</html>",
        )
    return Response(content, mimetype="text/html")


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/static/<path:filename>")
def flask_static(filename):
    return send_from_directory(STATIC_DIR, filename)


@app.route(f"/{ES3011_PREFIX}/")
def es3011_index():
    return serve_with_banner(os.path.join(SITE_DIR, "index.html"))


@app.route(f"/{ES3011_PREFIX}/<path:filename>")
def es3011_files(filename):
    filepath = os.path.join(SITE_DIR, filename)
    if os.path.isdir(filepath):
        idx = os.path.join(filepath, "index.html")
        if os.path.isfile(idx):
            return serve_with_banner(idx)
        abort(404)
    if filename.endswith(".html"):
        return serve_with_banner(filepath)
    return send_from_directory(SITE_DIR, filename)


@app.route("/")
def almas_index():
    return send_from_directory(ALMAS_DIR, "index.html")


@app.route("/<path:filename>")
def almas_files(filename):
    filepath = os.path.join(ALMAS_DIR, filename)
    if os.path.isdir(filepath):
        idx = os.path.join(filepath, "index.html")
        if os.path.isfile(idx):
            return send_from_directory(filepath, "index.html")
        abort(404)
    if not os.path.isfile(filepath):
        abort(404)
    return send_from_directory(ALMAS_DIR, filename)


# ── API routes ────────────────────────────────────────────────────────────

def build_chat_messages(system_prompt, question, context, history):
    system = system_prompt + "\n\n--- Page content ---\n" + context
    messages = [{"role": "system", "content": system}]
    for msg in history:
        if msg.get("role") in ("user", "assistant"):
            messages.append(msg)
    messages.append({"role": "user", "content": question})
    return messages


def call_zen(messages):
    import requests
    r = requests.post(
        f"{ZEN_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {ZEN_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": ZEN_MODEL, "messages": messages, "stream": False},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


@app.route("/api/chat", methods=["POST"])
def api_chat():
    if not ZEN_API_KEY:
        return jsonify({"error": "OPENCODE_API_KEY not set in .env"}), 500
    try:
        data = request.get_json()
        messages = build_chat_messages(
            SYSTEM_PROMPT, data.get("question", ""),
            data.get("context", ""), data.get("history", []),
        )
        reply = call_zen(messages)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tutor-chat", methods=["POST"])
def api_tutor_chat():
    if not ZEN_API_KEY:
        return jsonify({"error": "OPENCODE_API_KEY not set in .env"}), 500
    try:
        data = request.get_json()
        messages = build_chat_messages(
            TUTOR_PROMPT, data.get("question", ""),
            data.get("context", ""), data.get("history", []),
        )
        reply = call_zen(messages)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Freezer ───────────────────────────────────────────────────────────────

freezer = Freezer(app)

SKIP_ALMAS_PREFIXES = tuple(f"{d}/" for d in SKIP_DIRS) + (".gitignore", "freeze.py")


@freezer.register_generator
def almas_files():
    for root, dirs, files in os.walk(ALMAS_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            path = os.path.relpath(os.path.join(root, f), ALMAS_DIR)
            if path.startswith(SKIP_ALMAS_PREFIXES):
                continue
            yield {"filename": path}


@freezer.register_generator
def flask_static():
    for root, dirs, files in os.walk(STATIC_DIR):
        for f in files:
            path = os.path.relpath(os.path.join(root, f), STATIC_DIR)
            yield {"filename": path}


@freezer.register_generator
def es3011_files():
    for root, dirs, files in os.walk(SITE_DIR):
        for f in files:
            path = os.path.relpath(os.path.join(root, f), SITE_DIR)
            yield {"filename": path}


# ── Main ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        app.run(debug=True, port=8000)
    else:
        build_dir = os.path.join(HERE, "_build")
        if os.path.isdir(build_dir):
            shutil.rmtree(build_dir)
        freezer.freeze()
        print(f"\nDone! Static site written to {build_dir}")
        if API_BASE:
            print(f"API_BASE set to {API_BASE!r} — JS will call remote API")
        else:
            print("No API_BASE set — AI chat only works via 'python freeze.py serve'")
        print("Deploy the contents of _build/ to GitHub Pages.")
