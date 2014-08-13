var RemoveScript = (function () {

  self.port.on("undo", function (spansJSON) {
    self.port.emit("done");
  });

  self.port.on("erase", function (spansJSON) {
    self.port.emit("done");
  });

  self.on("click", function () {
    self.postMessage("done");
  });

  self.port.on("removeSpans", function (spansJSON) {
   console.log("undo/erase script entered with hiliteSpanID's: "+spansJSON);
   var spans = JSON.parse(spansJSON), span;
   for each (var spanID in spans) {
    span = document.getElementById(spanID)
    if (span) span.removeAttribute("style");
   }
  });


})();

