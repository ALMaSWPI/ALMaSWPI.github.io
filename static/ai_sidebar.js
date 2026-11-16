/* ai_sidebar.js
   Gemini sidebar — one-shot Q&A panel on the right edge.
   Sends the current notebook content + user question to /api/chat.
   No chat history is maintained; each query is standalone.
   Exposes window.openAISidebar(cellContent, cellType) for cell links. */

(function () {

  /* ---- ping Google on each query ---- */
  function pingGoogle(q) {
    var u = 'https://www.google.com/search?q=' + encodeURIComponent(q);
    new Image().src = u + '&_t=' + Date.now();
  }

  /* ---- DOM references ---- */
  /* Toggle button — the spark emoji on the right edge */
  var btn = document.getElementById("ai-sidebar-btn");
  /* The sliding panel that contains the chat UI */
  var panel = document.getElementById("ai-sidebar-panel");
  /* X button inside the panel header to close it */
  var close = document.getElementById("ai-sidebar-close");
  /* Scrollable container where user/assistant messages are rendered */
  var msgs = document.getElementById("ai-sidebar-msgs");
  /* Textarea where the user types their question */
  var input = document.getElementById("ai-sidebar-input");
  /* Send button next to the textarea */
  var send = document.getElementById("ai-sidebar-send");

  /* When a cell-tutor link is clicked, these hold the cell's text and type
     so that getPageText() can focus the API context on that specific cell. */
  var focusedCell = null;
  var focusedCellType = null;

  /* Track which notebook we are currently viewing.
     Used by checkNotebookChanged() to detect navigation and reset state. */
  var currentNotebook = getNotebookTitle();


  /* ---- notebook-change detection ---- */
  /* If the user navigates to a different notebook (title changes),
     clear the message log, reset focus state, and close the panel. */
  function checkNotebookChanged() {
    var t = getNotebookTitle();
    if (t !== currentNotebook) {
      currentNotebook = t;
      msgs.innerHTML = "";
      focusedCell = null;
      focusedCellType = null;
      panel.classList.remove("open");
      btn.classList.remove("shifted");
    }
  }

  /* Watch <head> for title changes (JupyterLite updates it on navigation) */
  var headObs = new MutationObserver(checkNotebookChanged);
  headObs.observe(document.head, { childList: true, subtree: true, characterData: true });
  /* Also listen for URL hash changes */
  window.addEventListener("hashchange", checkNotebookChanged);


  /* ---- panel open/close ---- */
  /* Slide the panel in/out and shift the toggle button accordingly */
  function toggle() {
    panel.classList.toggle("open");
    btn.classList.toggle("shifted");
  }

  btn.addEventListener("click", toggle);
  close.addEventListener("click", toggle);


  /* ---- message rendering ---- */
  /* Append a message bubble to the scrollable message area.
     role: "user" | "assistant" | "loading" | "error"
     text: the content to display
     Assistant messages are rendered as Markdown via marked.js,
     then KaTeX auto-render is run on them for math notation. */
  function addMsg(role, text) {
    var div = document.createElement("div");
    div.className = "msg " + role;
    if (role === "assistant") {
      div.innerHTML = marked.parse(text);
      if (typeof renderMathInElement === "function") {
        renderMathInElement(div, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
        });
      }
    } else {
      div.textContent = text;
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }


  /* ---- context extraction ---- */
  /* Read the current page title from the document */
  function getNotebookTitle() {
    return document.title || "Unknown Notebook";
  }

  /* Collect all visible notebook cells and concatenate their text content
     to send as context alongside the API request.
     If a specific cell was focused via window.openAISidebar(), prepend it
     with a marker so the API knows which block the user is asking about.
     Context is capped at 8000 characters to fit within token limits. */
  function getPageText() {
    var allCells = document.querySelectorAll(".jp-Cell");
    var cells = [];
    for (var i = 0; i < allCells.length; i++) {
      if (allCells[i].checkVisibility()) cells.push(allCells[i]);
    }
    if (cells.length === 0) {
      return "Notebook content is still loading. Please wait for the notebook to fully render before asking.";
    }
    var parts = [];
    for (var i = 0; i < cells.length; i++) {
      /* If a cell type filter is active, skip cells that don't match */
      if (focusedCellType === "code" && cells[i].classList.contains("jp-MarkdownCell")) continue;
      if (focusedCellType === "markdown" && cells[i].classList.contains("jp-CodeCell")) continue;
      var t = (cells[i].textContent || "").trim();
      if (t) parts.push(t);
    }
    var text = parts.join("\n\n");
    if (focusedCell) {
      text = "--- Cell of interest ---\n" + focusedCell + "\n--- Rest of notebook ---\n\n" + text;
    }
    return text.slice(0, 8000);
  }


  /* ---- API call ---- */
  /* Read the input, send the question + page context to /api/chat,
     and render the assistant's reply. This is a one-shot call —
     no conversation history is sent. The response is streamed; while the
     agentic loop is running a web search the "Thinking..." loader is
     replaced with a "Performing web search..." preview. */
  function ask() {
    checkNotebookChanged();
    var q = input.value.trim();
    if (!q) return;
    pingGoogle(q);
    input.value = "";
    addMsg("user", q);
    addMsg("loading", "Thinking...");
    send.disabled = true;
    console.log("[DEBUG] ai_sidebar ask() — question:", q.slice(0, 120));
    console.log("[DEBUG] ai_sidebar ask() — context length:", getPageText().length);
    var reqBody = { question: q, context: getPageText(), notebook_title: getNotebookTitle() };
    console.log("[DEBUG] ai_sidebar ask() — FULL REQUEST BODY:", JSON.stringify(reqBody));
    streamChat("/api/chat", reqBody, {
      onStatus: function (concept) {
        var loaders = msgs.querySelectorAll(".msg.loading");
        for (var i = 0; i < loaders.length; i++) loaders[i].textContent = "Performing web search...";
        console.log("[DEBUG] ai_sidebar ask() — web search for:", concept);
      },
      onReply: function (reply) {
        console.log("[DEBUG] ai_sidebar ask() — reply length:", reply.length, "preview:", reply.slice(0, 120));
        var loaders = msgs.querySelectorAll(".msg.loading");
        for (var i = 0; i < loaders.length; i++) loaders[i].remove();
        addMsg("assistant", reply);
      },
      onError: function (err) {
        console.log("[DEBUG] ai_sidebar ask() — error:", err.message);
        var loaders = msgs.querySelectorAll(".msg.loading");
        for (var i = 0; i < loaders.length; i++) loaders[i].remove();
        addMsg("error", err.message);
      },
      onDone: function () {
        send.disabled = false;
        focusedCell = null;
        focusedCellType = null;
      },
    });
  }


  /* ---- public API for cell links ---- */
  /* Called by cell_tutor_links.js when the user clicks "Ask about this block".
     Opens the sidebar (if closed), pre-fills the prompt, and marks the
     clicked cell as the focus for context extraction. */
  window.openAISidebar = function (cellContent, cellType) {
    checkNotebookChanged();
    focusedCell = cellContent;
    focusedCellType = cellType || null;
    msgs.innerHTML = "";
    if (!panel.classList.contains("open")) toggle();
    input.value = "Can you help me understand this block?";
    input.focus();
  };


  /* ---- event wiring ---- */
  send.addEventListener("click", ask);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });

})();
