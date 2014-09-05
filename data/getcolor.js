window.addEventListener("click", function(event) {
  var t = event.target;
  if (t.nodeName == "TD") {
   style=t.getAttribute("style");
   self.port.emit("color-sel",t.getAttribute("style"));
  }
 }, false);
