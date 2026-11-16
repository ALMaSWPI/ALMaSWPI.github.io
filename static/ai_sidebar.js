(function () {
  var btn = document.getElementById("ai-sidebar-btn");
  var panel = document.getElementById("ai-sidebar-panel");
  var close = document.getElementById("ai-sidebar-close");
  var msgs = document.getElementById("ai-sidebar-msgs");
  var input = document.getElementById("ai-sidebar-input");
  var send = document.getElementById("ai-sidebar-send");

  var focusedCell = null;
  var focusedCellType = null;
  var currentNotebook = getNotebookTitle();

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

  var headObs = new MutationObserver(checkNotebookChanged);
  headObs.observe(document.head, { childList: true, subtree: true, characterData: true });
  window.addEventListener("hashchange", checkNotebookChanged);

  function toggle() {
    panel.classList.toggle("open");
    btn.classList.toggle("shifted");
  }

  btn.addEventListener("click", toggle);
  close.addEventListener("click", toggle);

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

  function getNotebookTitle() {
    return document.title || "Unknown Notebook";
  }

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
      if (focusedCellType === "code" && cells[i].classList.contains("jp-MarkdownCell")) continue;
      if (focusedCellType === "markdown" && cells[i].classList.contains("jp-CodeCell")) continue;
      var t = (cells[i].textContent || "").trim();
      if (focusedCell && t === focusedCell) continue;
      if (t) parts.push(t);
    }
    var text = parts.join("\n\n");
    if (focusedCell) {
      text =
        "You are answering a question about one selected notebook block.\n" +
        "Treat the SELECTED BLOCK as the primary source. Focus your explanation on that block only.\n" +
        "Use the surrounding notebook context only lightly for orientation if it is necessary.\n\n" +
        "--- SELECTED BLOCK: PRIMARY CONTEXT ---\n" +
        focusedCell.slice(0, 5000) +
        "\n\n--- SURROUNDING NOTEBOOK CONTEXT: OPTIONAL BACKGROUND ONLY ---\n" +
        text.slice(0, 2500);
    }
    return text.slice(0, 8000);
  }

  function ask() {
    checkNotebookChanged();
    var q = input.value.trim();
    if (!q) return;
    var displayQuestion = q;
    input.value = "";
    if (focusedCell) {
      q =
        "Answer this question with heavy emphasis on the selected block only. " +
        "Use the rest of the notebook only as light background if needed.\n\n" +
        q;
    }
    addMsg("user", displayQuestion);
    addMsg("loading", "Thinking...");
    send.disabled = true;
    console.log("[DEBUG] ai_sidebar ask() — question:", q.slice(0, 120));
    console.log("[DEBUG] ai_sidebar ask() — context length:", getPageText().length);
    var reqBody = JSON.stringify({ question: q, context: getPageText(), notebook_title: getNotebookTitle() });
    console.log("[DEBUG] ai_sidebar ask() — FULL REQUEST BODY:", reqBody);
    var apiBase = window.API_BASE || "";
    fetch(apiBase + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: reqBody,
    })
      .then(function (r) {
        console.log("[DEBUG] ai_sidebar ask() — response status:", r.status);
        return r.json();
      })
      .then(function (data) {
        var loaders = msgs.querySelectorAll(".msg.loading");
        for (var i = 0; i < loaders.length; i++) loaders[i].remove();
        if (data.error) {
          console.log("[DEBUG] ai_sidebar ask() — error:", data.error);
          addMsg("error", data.error);
        } else {
          console.log("[DEBUG] ai_sidebar ask() — reply length:", data.reply.length, "preview:", data.reply.slice(0, 120));
          addMsg("assistant", data.reply);
        }
      })
      .catch(function (err) {
        console.log("[DEBUG] ai_sidebar ask() — fetch error:", err.message);
        var loaders = msgs.querySelectorAll(".msg.loading");
        for (var i = 0; i < loaders.length; i++) loaders[i].remove();
        addMsg("error", "Request failed: " + err.message);
      })
      .finally(function () {
        send.disabled = false;
        focusedCell = null;
        focusedCellType = null;
      });
  }

  window.openAISidebar = function (cellContent, cellType) {
    checkNotebookChanged();
    focusedCell = cellContent;
    focusedCellType = cellType || null;
    msgs.innerHTML = "";
    if (!panel.classList.contains("open")) toggle();
    input.value = "Can you help me understand this block?";
    input.focus();
  };

  send.addEventListener("click", ask);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });
})();
