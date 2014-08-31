var ColorScript = (function () {

  // Event listeners for content scripts:

  self.port.on("color", function () {
    self.port.emit("done");
  });

  self.on("click", function () {
    console.log("api click");
    self.postMessage();
  });

})();

