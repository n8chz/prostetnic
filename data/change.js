self.port.on("updateIcon", function (newStyle) {
  var styleArray = newStyle.split(/[;:]/);
  var background = styleArray[styleArray.indexOf("background")+1];
  var color = styleArray[styleArray.indexOf("color")+1];
  document.getElementById("square").setAttribute("fill", background);
  document.getElementById("a").setAttribute("fill", color);
  self.port.emit("newIcon", window.btoa(document.firstChild.outerHTML)); // see https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs?redirectlocale=en-US&redirectslug=The_data_URL_scheme
});




