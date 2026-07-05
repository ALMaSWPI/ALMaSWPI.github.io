/* cell_tutor_links.js
   This script adds an "Ask about this block" link at
   the bottom of every Jupyter notebook cell. When clicked, the
   link opens the Big Pickle sidebar and sends the cell content
   as a one-shot question. */

(function () {
  function addLinkToCell(cell) {
    if (cell.querySelector(".ask-ai-tutor-link")) return;

    var container = document.createElement("div");
    container.className = "ask-ai-tutor-link";

    var a = document.createElement("a");
    a.href = "#";
    a.textContent = "Ask about this block";

    a.addEventListener("click", function (e) {
      e.preventDefault();

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

  var existing = document.querySelectorAll(".jp-Cell");
  for (var i = 0; i < existing.length; i++) addLinkToCell(existing[i]);

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType !== 1) continue;

        if (added[j].matches && added[j].matches(".jp-Cell")) {
          addLinkToCell(added[j]);
        }

        if (added[j].querySelectorAll) {
          var cells = added[j].querySelectorAll(".jp-Cell");
          for (var k = 0; k < cells.length; k++) addLinkToCell(cells[k]);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
