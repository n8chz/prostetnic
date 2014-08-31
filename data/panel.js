var PanelScript = (function () {

  window.addEventListener("click", function(event) {
    console.log("window click");
    var t = event.target;
    if (t.nodeName == "TD") {
     console.log("about to emit style: "+t.getAttribute("style"));
     self.port.emit("newStyle",t.getAttribute("style"));
    }
  }, false);

})();

