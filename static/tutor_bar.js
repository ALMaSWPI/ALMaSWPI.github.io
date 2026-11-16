(function () {
  var btn = document.getElementById("tutor-bar-btn");
  var panel = document.getElementById("tutor-bar-panel");
  var close = document.getElementById("tutor-bar-close");
  var output = document.getElementById("tutor-bar-output");
  var input = document.getElementById("tutor-bar-input");
  var send = document.getElementById("tutor-bar-send");
  var promptLabel = document.getElementById("tutor-prompt-label");

  var cellNum = 1;
  var tutor_history = [];
  var loadingEl = null;
  var started = false;
  var currentNotebook = getNotebookTitle();

  function checkNotebookChanged() {
    var t = getNotebookTitle();
    if (t !== currentNotebook) {
      currentNotebook = t;
      tutor_history = [];
      cellNum = 1;
      started = false;
      loadingEl = null;
      output.innerHTML = "";
      promptLabel.textContent = "In [1]:";
      panel.classList.remove("open");
      btn.classList.remove("hidden");
    }
  }

  var headObs = new MutationObserver(checkNotebookChanged);
  headObs.observe(document.head, { childList: true, subtree: true, characterData: true });
  window.addEventListener("hashchange", checkNotebookChanged);

  function getNotebookTitle() {
    return document.title || "Unknown Notebook";
  }

  function toggle() {
    checkNotebookChanged();
    panel.classList.toggle("open");
    btn.classList.toggle("hidden");
    if (panel.classList.contains("open")) {
      input.focus();
      if (!started) startTutoring();
    }
  }

  btn.addEventListener("click", toggle);
  close.addEventListener("click", toggle);

  function addBlock(label, text, isError) {
    var block = document.createElement("div");
    block.className = "tutor-block";
    var lbl = document.createElement("div");
    lbl.className = "tutor-label" + (isError ? " error" : "");
    lbl.textContent = label;
    block.appendChild(lbl);
    var content = document.createElement("div");
    content.className = "tutor-content";
    if (label.charAt(0) === "O" && !isError) {
      content.innerHTML = marked.parse(text);
      if (typeof renderMathInElement === "function") {
        renderMathInElement(content, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
        });
      }
    } else {
      content.textContent = text;
    }
    block.appendChild(content);
    output.appendChild(block);
    output.scrollTop = output.scrollHeight;
    return block;
  }

  function getPageText() {
    var allCells = document.querySelectorAll(".jp-MarkdownCell");
    var cells = [];
    for (var i = 0; i < allCells.length; i++) {
      if (allCells[i].checkVisibility()) cells.push(allCells[i]);
    }
    if (cells.length === 0) {
      return "Notebook content is still loading. Please wait for the notebook to fully render before asking.";
    }
    var parts = [];
    for (var i = 0; i < cells.length; i++) {
      var t = (cells[i].textContent || "").trim();
      if (t) parts.push(t);
    }
    return parts.join("\n\n").slice(0, 8000);
  }

  function startTutoring() {
    started = true;
    loadingEl = addBlock("Out [" + cellNum + "]:", "Thinking...");
    send.disabled = true;
    console.log("[DEBUG] tutor_bar startTutoring() — sending initial question");
    console.log("[DEBUG] tutor_bar startTutoring() — context length:", getPageText().length);
    var reqBody = JSON.stringify({ question: "Begin the tutoring session.", context: getPageText(), history: [], notebook_title: getNotebookTitle() });
    console.log("[DEBUG] tutor_bar startTutoring() — FULL REQUEST BODY:", reqBody);
    var apiBase = window.API_BASE || "";
    fetch(apiBase + "/api/tutor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: reqBody,
    })
      .then(function (r) {
        console.log("[DEBUG] tutor_bar startTutoring() — response status:", r.status);
        return r.json();
      })
      .then(function (data) {
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        if (data.error) {
          console.log("[DEBUG] tutor_bar startTutoring() — error:", data.error);
          addBlock("Out [" + cellNum + "]:", data.error, true);
          started = false;
        } else {
          console.log("[DEBUG] tutor_bar startTutoring() — reply length:", data.reply.length, "preview:", data.reply.slice(0, 120));
          addBlock("Out [" + cellNum + "]:", data.reply);
          var nt = getNotebookTitle();
          tutor_history.push({ role: "assistant", content: data.reply });
        }
        cellNum++;
      })
      .catch(function (err) {
        console.log("[DEBUG] tutor_bar startTutoring() — fetch error:", err.message);
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", "Request failed: " + err.message, true);
        started = false;
      })
      .finally(function () {
        send.disabled = false;
      });
  }

  function ask() {
    checkNotebookChanged();
    var q = input.value.trim();
    if (!q) return;
    input.value = "";

    var promptStr = "In [" + cellNum + "]:";
    promptLabel.textContent = "In [" + (cellNum + 1) + "]:";
    addBlock(promptStr, q);
    loadingEl = addBlock("Out [" + cellNum + "]:", "Thinking...");
    send.disabled = true;

    console.log("[DEBUG] tutor_bar ask() — question:", q.slice(0, 120));
    console.log("[DEBUG] tutor_bar ask() — context length:", getPageText().length, "history length:", tutor_history.length);
    var reqBody = JSON.stringify({ question: q, context: getPageText(), history: tutor_history, notebook_title: getNotebookTitle() });
    console.log("[DEBUG] tutor_bar ask() — FULL REQUEST BODY:", reqBody);
    var apiBase = window.API_BASE || "";
    fetch(apiBase + "/api/tutor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: reqBody,
    })
      .then(function (r) {
        console.log("[DEBUG] tutor_bar ask() — response status:", r.status);
        return r.json();
      })
      .then(function (data) {
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        if (data.error) {
          console.log("[DEBUG] tutor_bar ask() — error:", data.error);
          addBlock("Out [" + cellNum + "]:", data.error, true);
        } else {
          console.log("[DEBUG] tutor_bar ask() — reply length:", data.reply.length, "preview:", data.reply.slice(0, 120));
          addBlock("Out [" + cellNum + "]:", data.reply);
          var nt = getNotebookTitle();
          tutor_history.push({ role: "user", content: "[" + nt + "] " + q });
          tutor_history.push({ role: "assistant", content: data.reply });
          if (tutor_history.length > 10) tutor_history = tutor_history.slice(-10);
        }
        cellNum++;
      })
      .catch(function (err) {
        console.log("[DEBUG] tutor_bar ask() — fetch error:", err.message);
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", "Request failed: " + err.message, true);
      })
      .finally(function () {
        send.disabled = false;
      });
  }

  send.addEventListener("click", ask);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });
})();
