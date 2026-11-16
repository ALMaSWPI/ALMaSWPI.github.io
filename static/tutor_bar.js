/* tutor_bar.js
   AI Tutor bar — bottom panel for Socratic tutoring.
   Maintains a rolling history (last 10 turns) and sends it
   to /api/tutor-chat. Auto-sends a "Begin the tutoring session"
   message on first open. Notebook change resets the session. */

(function () {

  /* ---- ping Google on each query ---- */
  function pingGoogle(q) {
    var u = 'https://www.google.com/search?q=' + encodeURIComponent(q);
    new Image().src = u + '&_t=' + Date.now();
  }

  /* ---- DOM references ---- */
  /* Toggle button at the bottom of the viewport */
  var btn = document.getElementById("tutor-bar-btn");
  /* The sliding panel that rises from the bottom */
  var panel = document.getElementById("tutor-bar-panel");
  /* X button in the panel header */
  var close = document.getElementById("tutor-bar-close");
  /* Scrollable area where In/Out blocks are rendered */
  var output = document.getElementById("tutor-bar-output");
  /* Textarea for the user's answer or question */
  var input = document.getElementById("tutor-bar-input");
  /* Send button */
  var send = document.getElementById("tutor-bar-send");
  /* The "In [1]:" prompt label next to the textarea */
  var promptLabel = document.getElementById("tutor-prompt-label");

  /* Track the current prompt number (In [1], Out [1], In [2], ...) */
  var cellNum = 1;
  /* Rolling conversation history sent to the API (max 10 entries) */
  var tutor_history = [];
  /* Reference to the currently displayed "Thinking..." block, so we can remove it */
  var loadingEl = null;
  /* Whether the initial auto-tutoring message has been sent */
  var started = false;
  /* Track which notebook we're on; reset when it changes */
  var currentNotebook = getNotebookTitle();


  /* ---- notebook-change detection ---- */
  /* When the notebook title changes (user navigates), reset everything:
     history, cell counter, panel state, and prompt label. */
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

  /* Watch head for title changes and listen for hash changes */
  var headObs = new MutationObserver(checkNotebookChanged);
  headObs.observe(document.head, { childList: true, subtree: true, characterData: true });
  window.addEventListener("hashchange", checkNotebookChanged);


  /* ---- helpers ---- */
  /* Read the current page title from the document */
  function getNotebookTitle() {
    return document.title || "Unknown Notebook";
  }


  /* ---- panel open/close ---- */
  /* Slide the panel up/down, hide the toggle button while open,
     focus the textarea, and auto-start the session on first open. */
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


  /* ---- message rendering ---- */
  /* Create and append a labelled block to the output area.
     label: e.g. "In [1]:" or "Out [1]:"
     text: the content
     isError: if true, apply error styling to the label
     Returns the block element so callers can remove it later. */
  function addBlock(label, text, isError) {
    var block = document.createElement("div");
    block.className = "tutor-block";
    var lbl = document.createElement("div");
    lbl.className = "tutor-label" + (isError ? " error" : "");
    lbl.textContent = label;
    block.appendChild(lbl);
    var content = document.createElement("div");
    content.className = "tutor-content";
    /* Only render Markdown/LaTeX for Out blocks (the assistant's replies);
       In blocks (user input) are shown as plain text. */
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


  /* ---- context extraction ---- */
  /* Collect all visible Markdown cells from the notebook and concatenate
     their text to send as context. The tutor only reads markdown cells
     (not code) to focus on theoretical content. Capped at 8000 chars. */
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


  /* ---- session start ---- */
  /* Automatically called on first panel open. Sends a "Begin the tutoring
     session" message to the API so the tutor initiates the Socratic dialogue
     with an opening question rather than waiting for user input. */
  function startTutoring() {
    started = true;
    pingGoogle("Begin the tutoring session.");
    loadingEl = addBlock("Out [" + cellNum + "]:", "Thinking...");
    send.disabled = true;
    console.log("[DEBUG] tutor_bar startTutoring() — sending initial question");
    console.log("[DEBUG] tutor_bar startTutoring() — context length:", getPageText().length);
    var reqBody = { question: "Begin the tutoring session.", context: getPageText(), history: [], notebook_title: getNotebookTitle() };
    console.log("[DEBUG] tutor_bar startTutoring() — FULL REQUEST BODY:", JSON.stringify(reqBody));
    streamChat("/api/tutor-chat", reqBody, {
      onStatus: function (concept) {
        if (loadingEl) loadingEl.querySelector(".tutor-content").textContent = "Performing web search...";
        console.log("[DEBUG] tutor_bar startTutoring() — web search for:", concept);
      },
      onReply: function (reply) {
        console.log("[DEBUG] tutor_bar startTutoring() — reply length:", reply.length, "preview:", reply.slice(0, 120));
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", reply);
        var nt = getNotebookTitle();
        tutor_history.push({ role: "assistant", content: reply });
        cellNum++;
      },
      onError: function (err) {
        console.log("[DEBUG] tutor_bar startTutoring() — error:", err.message);
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", err.message, true);
        started = false;
        cellNum++;
      },
      onDone: function () {
        send.disabled = false;
      },
    });
  }


  /* ---- user ask ---- */
  /* Send the user's typed input + conversation history to /api/tutor-chat.
     Renders the user's question as an In block and the reply as an Out block.
     Maintains a rolling window of the last 10 history entries. The response
     is streamed; a web search by the agentic loop swaps the "Thinking..."
     loader for a "Performing web search..." preview. */
  function ask() {
    checkNotebookChanged();
    var q = input.value.trim();
    if (!q) return;
    pingGoogle(q);
    input.value = "";

    var promptStr = "In [" + cellNum + "]:";
    promptLabel.textContent = "In [" + (cellNum + 1) + "]:";
    addBlock(promptStr, q);
    loadingEl = addBlock("Out [" + cellNum + "]:", "Thinking...");
    send.disabled = true;

    console.log("[DEBUG] tutor_bar ask() — question:", q.slice(0, 120));
    console.log("[DEBUG] tutor_bar ask() — context length:", getPageText().length, "history length:", tutor_history.length);
    var reqBody = { question: q, context: getPageText(), history: tutor_history, notebook_title: getNotebookTitle() };
    console.log("[DEBUG] tutor_bar ask() — FULL REQUEST BODY:", JSON.stringify(reqBody));
    streamChat("/api/tutor-chat", reqBody, {
      onStatus: function (concept) {
        if (loadingEl) loadingEl.querySelector(".tutor-content").textContent = "Performing web search...";
        console.log("[DEBUG] tutor_bar ask() — web search for:", concept);
      },
      onReply: function (reply) {
        console.log("[DEBUG] tutor_bar ask() — reply length:", reply.length, "preview:", reply.slice(0, 120));
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", reply);
        var nt = getNotebookTitle();
        tutor_history.push({ role: "user", content: "[" + nt + "] " + q });
        tutor_history.push({ role: "assistant", content: reply });
        if (tutor_history.length > 10) tutor_history = tutor_history.slice(-10);
        cellNum++;
      },
      onError: function (err) {
        console.log("[DEBUG] tutor_bar ask() — error:", err.message);
        if (loadingEl) { loadingEl.remove(); loadingEl = null; }
        addBlock("Out [" + cellNum + "]:", err.message, true);
        cellNum++;
      },
      onDone: function () {
        send.disabled = false;
      },
    });
  }


  /* ---- answer button clicks ---- */
  /* Event delegation for both single-select and multi-select answer buttons.
     Single-select: clicking one button instantly shows correct/incorrect.
     Multi-select: buttons toggle selection; a Submit button checks answers. */
  output.addEventListener("click", function (e) {
    /* Handle multi-select Submit button */
    var submitBtn = e.target.closest(".tutor-submit-btn");
    if (submitBtn && !submitBtn.disabled) {
      var container = submitBtn.closest(".tutor-multi-group");
      if (!container) return;
      var btns = container.querySelectorAll(".tutor-answer-btn");
      var allCorrect = true;
      var falsePositives = [];
      var falseNegatives = [];
      var correctPicks = [];
      for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
        var isSelected = btns[i].classList.contains("selected");
        var isCorrect = btns[i].dataset.correct === "true";
        var optionText = btns[i].textContent.trim();
        if (isSelected && isCorrect) {
          btns[i].classList.add("correct");
          correctPicks.push(optionText);
        } else if (isSelected && !isCorrect) {
          btns[i].classList.add("incorrect");
          falsePositives.push(optionText);
          allCorrect = false;
        } else if (!isSelected && isCorrect) {
          btns[i].classList.add("missed");
          falseNegatives.push(optionText);
          allCorrect = false;
        }
        btns[i].classList.remove("selected");
      }
      submitBtn.disabled = true;
      submitBtn.classList.add(allCorrect ? "correct" : "incorrect");

      /* Build feedback legend */
      var legend = document.createElement("div");
      legend.className = "tutor-feedback-legend";
      legend.innerHTML =
        '<span class="legend-item"><span class="legend-dot correct"></span>Correctly selected</span>' +
        '<span class="legend-item"><span class="legend-dot incorrect"></span>Incorrectly selected (false positive)</span>' +
        '<span class="legend-item"><span class="legend-dot missed"></span>Missed correct (false negative)</span>';
      container.appendChild(legend);

      /* Build feedback summary */
      var summary = document.createElement("div");
      summary.className = "tutor-feedback-summary";
      if (allCorrect) {
        summary.innerHTML = '<div class="summary-header all-correct">All correct!</div>' +
          '<div>You selected all ' + correctPicks.length + ' correct option' + (correctPicks.length !== 1 ? 's' : '') + '.</div>';
      } else {
        var parts = [];
        parts.push('<div class="summary-header has-errors">Not quite right</div>');
        if (falsePositives.length > 0) {
          parts.push('<div class="false-pos"><strong>False positives</strong> (you selected these but they are incorrect):</div>');
          for (var j = 0; j < falsePositives.length; j++) {
            parts.push('<div class="false-pos">&nbsp;&nbsp;- ' + falsePositives[j] + '</div>');
          }
        }
        if (falseNegatives.length > 0) {
          parts.push('<div class="false-neg"><strong>False negatives</strong> (you missed these correct answers):</div>');
          for (var k = 0; k < falseNegatives.length; k++) {
            parts.push('<div class="false-neg">&nbsp;&nbsp;- ' + falseNegatives[k] + '</div>');
          }
        }
        summary.innerHTML = parts.join("");
      }
      container.appendChild(summary);
      return;
    }

    /* Handle single-select answer button */
    var btn = e.target.closest(".tutor-answer-btn");
    if (!btn || btn.disabled) return;
    var parent = btn.parentElement;

    /* Check if this is inside a multi-select group */
    var multiGroup = parent.closest(".tutor-multi-group");
    if (multiGroup) {
      /* Multi-select: toggle selection state */
      btn.classList.toggle("selected");
      return;
    }

    /* Single-select: highlight clicked, show correct, disable all */
    var siblings = parent.querySelectorAll(".tutor-answer-btn");
    for (var i = 0; i < siblings.length; i++) {
      siblings[i].disabled = true;
      if (siblings[i] === btn) {
        siblings[i].classList.add(btn.dataset.correct === "true" ? "correct" : "incorrect");
      } else if (siblings[i].dataset.correct === "true") {
        siblings[i].classList.add("correct");
      }
    }
  });

  /* ---- event wiring ---- */
  send.addEventListener("click", ask);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });

})();
