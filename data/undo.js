var UndoScript = (function () {

  self.port.on("undo", function (spansJSON) {
    self.port.emit("done");
  });

  self.on("click", function () {
    self.postMessage("done");
  });

  self.port.on("undoAlready", function (spansJSON) {
   console.log("undo script entered with hiliteSpanID's: "+spansJSON);
   var spans = JSON.parse(spansJSON);
   for each (var spanID in spans) {
    document.getElementById(spanID).removeAttribute("style");
   }
  }
);


})();

