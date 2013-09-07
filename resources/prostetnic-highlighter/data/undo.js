
self.port.on("undoHilite",function(stackString) {
  //alert(stackString);
  var stack=JSON.parse(stackString);
  self.postMessage(JSON.stringify(undo(stack)));
})