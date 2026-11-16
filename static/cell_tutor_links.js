/* cell_tutor_links.js
   Adds an "Ask about this block" link to every notebook cell
   via MutationObserver on .jp-Cell elements. Clicking the link
   calls window.openAISidebar() to open the Gemini sidebar
   with the cell's content pre-loaded. */

(function () {

  /* ---- add link to a single cell ---- */
  /* If the cell doesn't already have our link, create a container div
     and an anchor element, then append it to the cell. Clicking the link
     clones the cell (to strip out any pre-existing link elements), reads
     the text content, determines the cell type (code vs markdown), and
     delegates to window.openAISidebar(). */
  function addLinkToCell(cell) {
    /* Avoid adding duplicate links */
    if (cell.querySelector(".ask-ai-tutor-link")) return;

    var container = document.createElement("div");
    container.className = "ask-ai-tutor-link";

    var a = document.createElement("a");
    a.href = "#";
    a.textContent = "Ask about this block";

    a.addEventListener("click", function (e) {
      e.preventDefault();

      /* Clone the cell so we can strip our own link from the text
         without mutating the live DOM cell */
      var clone = cell.cloneNode(true);
      var links = clone.querySelectorAll(".ask-ai-tutor-link");
      for (var i = 0; i < links.length; i++) links[i].remove();
      var cellText = (clone.textContent || "").trim();

      var cellType = cell.classList.contains("jp-CodeCell") ? "code" : "markdown";
      if (window.openAISidebar) window.openAISidebar(cellText, cellType);
    });

    container.appendChild(a);
    cell.appendChild(container);
  }


  /* ---- seed existing cells ---- */
  /* Process any cells that already exist in the DOM when the script loads */
  var existing = document.querySelectorAll(".jp-Cell");
  for (var i = 0; i < existing.length; i++) addLinkToCell(existing[i]);


  /* ---- watch for new cells ---- */
  /* JupyterLite is an SPA — cells are dynamically added as notebooks load
     and as the user navigates. Use a MutationObserver on <body> to detect
     newly inserted .jp-Cell elements and attach links to them. */
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        /* Skip non-element nodes (text nodes, comments, etc.) */
        if (added[j].nodeType !== 1) continue;

        /* If the added node itself is a cell, process it directly */
        if (added[j].matches && added[j].matches(".jp-Cell")) {
          addLinkToCell(added[j]);
        }

        /* If the added node contains cells (e.g. a notebook widget),
           find them via querySelectorAll and process each one */
        if (added[j].querySelectorAll) {
          var cells = added[j].querySelectorAll(".jp-Cell");
          for (var k = 0; k < cells.length; k++) addLinkToCell(cells[k]);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
