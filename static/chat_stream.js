/* chat_stream.js
   Shared helper to POST to /api/chat or /api/tutor-chat and consume the
   response. Two backend shapes are supported:
     1. Plain JSON (api-server/app.py on Vercel, freeze.py serve):
        {"reply": ...} on success, {"error": ...} on failure.
     2. SSE-style streamed events as "data: {json}\n\n" lines:
        {"type":"searching","concept":...}  — the agentic loop is hitting the web
        {"type":"reply","reply":...}        — the final answer
        {"type":"error","error":...}        — a backend error
   The request URL is prefixed with window.API_BASE (baked in by freeze.py)
   so the GitHub Pages site can reach the API on another origin.
   Callers pass callbacks: onStatus(concept), onReply(reply),
   onError(err), onDone(). */

window.streamChat = function (url, body, callbacks) {
  var onStatus = callbacks.onStatus || function () {};
  var onReply = callbacks.onReply || function () {};
  var onError = callbacks.onError || function () {};
  var onDone = callbacks.onDone || function () {};

  fetch((window.API_BASE || "") + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          throw new Error(d.error || "Request failed: " + r.status);
        });
      }
      var contentType = r.headers.get("content-type") || "";
      if (contentType.indexOf("application/json") !== -1) {
        return r.json().then(function (d) {
          if (typeof d.reply === "string") onReply(d.reply);
          else onError(new Error(d.error || "Bad server response"));
          onDone();
          return null;
        });
      }
      return r.body.getReader();
    })
    .then(function (reader) {
      if (!reader) return;
      var decoder = new TextDecoder();
      var buffer = "";
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) {
            onDone();
            return;
          }
          buffer += decoder.decode(res.value, { stream: true });
          var chunks = buffer.split("\n\n");
          buffer = chunks.pop();
          for (var i = 0; i < chunks.length; i++) {
            var lines = chunks[i].split("\n");
            for (var j = 0; j < lines.length; j++) {
              var line = lines[j];
              if (line.indexOf("data: ") === 0) {
                try {
                  var evt = JSON.parse(line.slice(6));
                  if (evt.type === "searching") onStatus(evt.source, evt.concept);
                  else if (evt.type === "reply") onReply(evt.reply);
                  else if (evt.type === "error") onError(new Error(evt.error || "Unknown error"));
                } catch (e) {
                  onError(new Error("Bad server event: " + e.message));
                }
              }
            }
          }
          return pump();
        });
      }
      return pump();
    })
    .catch(onError);
};
