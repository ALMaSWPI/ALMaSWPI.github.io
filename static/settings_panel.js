/* settings_panel.js
   Settings gear button (bottom-right) that opens a small panel
   with toggles for code visibility and AI button visibility.
   Calls window.setCodeVisibility / window.setAIVisibility
   from hide_code.js on toggle change. */

(function () {

  /* ---- DOM references ---- */
  /* The sliding settings panel */
  var panel = document.getElementById("settings-panel");
  /* Gear button that toggles the panel */
  var btn = document.getElementById("settings-btn");
  /* X button inside the panel header */
  var closeBtn = document.getElementById("settings-close");
  /* Checkbox for toggling code cell visibility */
  var codeToggle = document.getElementById("code-visibility-toggle");
  /* Checkbox for toggling AI button/link visibility */
  var aiToggle = document.getElementById("ai-visibility-toggle");

  /* Bail out if any required element is missing from the DOM */
  if (!panel || !btn || !closeBtn || !codeToggle || !aiToggle) return;


  /* ---- panel open/close ---- */
  function openPanel() { panel.classList.add("open"); }
  function closePanel() { panel.classList.remove("open"); }

  /* Toggle open/close when the gear button is clicked */
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (panel.classList.contains("open")) {
      closePanel();
    } else {
      openPanel();
    }
  });

  /* Close when the X button is clicked */
  closeBtn.addEventListener("click", closePanel);

  /* Close when the user clicks outside the panel */
  document.addEventListener("click", function (e) {
    if (panel.classList.contains("open") &&
        !panel.contains(e.target) &&
        e.target !== btn) {
      closePanel();
    }
  });


  /* ---- initialise toggle state from hide_code.js ---- */
  /* Read the current visibility state from hide_code.js's public API
     and sync the checkbox to match. Default to visible if the API
     isn't available yet. */
  codeToggle.checked = window.isCodeVisible ? window.isCodeVisible() : true;
  aiToggle.checked = window.isAIVisible ? window.isAIVisible() : true;


  /* ---- toggle event handlers ---- */
  /* When the user flips the code visibility switch, delegate to
     hide_code.js's setCodeVisibility to apply the change and persist it. */
  codeToggle.addEventListener("change", function () {
    if (window.setCodeVisibility) {
      window.setCodeVisibility(codeToggle.checked);
    }
  });

  /* Same for the AI visibility toggle */
  aiToggle.addEventListener("change", function () {
    if (window.setAIVisibility) {
      window.setAIVisibility(aiToggle.checked);
    }
  });

})();
