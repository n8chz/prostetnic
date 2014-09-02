var PanelScript = (function () {

  window.addEventListener("click", function(event) {
    console.log("window click");
    var t = event.target;
    if (t.nodeName == "TD") {
     self.port.emit("newStyle",t.getAttribute("style"));
    }
  }, false);

})();

