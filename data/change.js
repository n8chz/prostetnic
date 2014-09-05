self.port.on("updateIcon", function (newStyle) {
  var styleArray = newStyle.split(/[;:]\s*/);
  var index = styleArray.indexOf("background-color");
  if (index !== -1) {
   document.getElementById("square").setAttribute("fill", styleArray[index+1]);
  }
  index = styleArray.indexOf("color");
  if (index !== -1) {
   document.getElementById("a").setAttribute("fill", styleArray[index+1]);
  }
  self.port.emit("newIcon", window.btoa(document.firstChild.outerHTML)); // see https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs?redirectlocale=en-US&redirectslug=The_data_URL_scheme
});




