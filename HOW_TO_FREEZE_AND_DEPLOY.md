# Freeze & Deploy Guide

## Layout

```
ALMaSWPI.github.io/
├── freeze.py                    # Flask app + Frozen-Flask build script
├── .github/workflows/deploy.yml # CI: builds & deploys on push to main
├── es3011-content/              # JupyterLite _site/ (notebooks)
├── templates/                   # banner.html, ai_sidebar.html, tutor_bar.html
├── static/                      # CSS/JS/prompts for the injections
├── api-server/                  # Standalone Flask API for Vercel
│   ├── app.py
│   └── requirements.txt
└── (ALMaSWPI site files)
```

## Full Walkthrough

### 1. Update notebooks

```bash
cp -r ~/JupyterBasedControlEngineeringTextbook/_site \
      /path/to/ALMaSWPI.github.io/es3011-content
```

### 2. Edit templates / styles / prompts

| File | What it does |
|---|---|
| `templates/banner.html` | Red "WPI ES3011" bar |
| `templates/ai_sidebar.html` | "Ask Gemini" sidebar |
| `templates/tutor_bar.html` | AI tutor bar |
| `static/css/*.css` | Styles for the above |
| `static/system_prompt.txt` | System prompt for `/api/chat` |
| `static/tutor_prompt.txt` | System prompt for `/api/tutor-chat` |

Asset paths in templates must start with `/static/` — `freeze.py` rewrites them
to relative paths at build time.

### 3. Deploy the AI API to Vercel

The sidebar/tutor need a live API. Deploy `api-server/` to Vercel:

1. **vercel.com → Add New → Project** → import this repo
2. **Settings → General → Root Directory** → set `api-server/`
3. **Environment Variables** → add `OPENCODE_API_KEY`
4. **Deploy** → you get a URL like `https://al-ma-swpi-github-io.vercel.app`

### 4. Set API_BASE (so the JS knows where to call)

**GitHub → Settings → Variables and Secrets → Actions → Repository variables**
→ **"Add variable"**:

| Field | Value |
|---|---|
| Name | `API_BASE` |
| Value | `https://al-ma-swpi-github-io.vercel.app` |

On every push to `main`, the CI build reads `API_BASE` and injects
`<script>window.API_BASE="..."</script>` into the frozen Jupyter HTML.
Without it, the sidebar calls `/api/chat` (only works locally).

### 5. Preview locally

```bash
# needs a .env file with OPENCODE_API_KEY
python freeze.py serve
```

Opens on http://localhost:8000 — both static site and API work.

### 6. Build & deploy

Push to `main`. CI does everything. Output goes to `_build/` (gitignored).

## How it works

```
Browser (GitHub Pages)
    │
    ├── window.API_BASE ─────────────┐
    │                                 │
    ▼                                 ▼
/api/chat (local only)          Vercel Flask API
(freeze.py serve)               (api-server/app.py)
                                      │
                                      ▼
                                 opencode.ai (LLM)
```
