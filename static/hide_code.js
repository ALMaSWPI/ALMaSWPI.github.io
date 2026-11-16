/* hide_code.js
   Toggles code cell and AI element visibility.
   Exposes window.setCodeVisibility(show) and
   window.setAIVisibility(show) for the Settings panel
   to call. Persists state in localStorage. */

(function () {

  /* ---- CSS class constants ---- */
  /* Added to <body> to hide code cells via CSS (display: none on .jp-Cell-inputWrapper) */
  var HIDE_CODE_CLASS = "jp-mod-hide-code";
  /* Added to <body> to hide AI sidebar/tutor buttons and cell links */
  var HIDE_AI_CLASS = "jp-mod-hide-ai";

  /* ---- localStorage keys ---- */
  var CODE_STORAGE_KEY = "jp-hide-code-state";
  var AI_STORAGE_KEY = "jp-hide-ai-state";


  /* ---- state application ---- */
  /* Add/remove the hide-code class on <body> and persist to localStorage.
     hidden: true  -> hide code cells
     hidden: false -> show code cells */
  function applyCodeState(hidden) {
    document.body.classList.toggle(HIDE_CODE_CLASS, !!hidden);
    try { localStorage.setItem(CODE_STORAGE_KEY, hidden ? "1" : "0"); } catch (e) {}
  }

  /* Same for AI element visibility */
  function applyAIState(hidden) {
    document.body.classList.toggle(HIDE_AI_CLASS, !!hidden);
    try { localStorage.setItem(AI_STORAGE_KEY, hidden ? "1" : "0"); } catch (e) {}
  }


  /* ---- initialise from localStorage ---- */
  /* On page load, read persisted state and apply it.
     Code cells are hidden by default (key === null -> hide).
     AI elements are visible by default (key === null -> show). */
  try {
    var codeKey = localStorage.getItem(CODE_STORAGE_KEY);
    if (codeKey === "1") {
      document.body.classList.add(HIDE_CODE_CLASS);
    }
    if (codeKey === null) {
      localStorage.setItem(CODE_STORAGE_KEY, "0");
    }

    var aiKey = localStorage.getItem(AI_STORAGE_KEY);
    if (aiKey === "1") {
      document.body.classList.add(HIDE_AI_CLASS);
    }
    if (aiKey === null) {
      localStorage.setItem(AI_STORAGE_KEY, "0");
    }
  } catch (e) {}


  /* ---- public API ---- */
  /* Set code visibility. show=true means code cells are visible. */
  window.setCodeVisibility = function (show) {
    applyCodeState(!show);
    return show;
  };

  /* Query current code visibility state */
  window.isCodeVisible = function () {
    return !document.body.classList.contains(HIDE_CODE_CLASS);
  };

  /* Set AI element visibility. show=true means AI buttons/links are visible. */
  window.setAIVisibility = function (show) {
    applyAIState(!show);
    return show;
  };

  /* Query current AI visibility state */
  window.isAIVisible = function () {
    return !document.body.classList.contains(HIDE_AI_CLASS);
  };

})();
