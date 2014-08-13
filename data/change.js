self.port.on("updateIcon", function (newStyle) {
  var styleArray = newStyle.split(/[;:]\s*/);
  console.log("styleArray: "+JSON.stringify(styleArray));
  var background = styleArray[styleArray.indexOf("background-color")+1];
  var color = styleArray[styleArray.indexOf("color")+1];
  console.log("background: "+background+" color: "+color);
  document.getElementById("square").setAttribute("fill", background);
  document.getElementById("a").setAttribute("fill", color);
  console.log("new SVG:\n"+document.firstChild.outerHTML);
  self.port.emit("newIcon", window.btoa(document.firstChild.outerHTML)); // see https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs?redirectlocale=en-US&redirectslug=The_data_URL_scheme
});




