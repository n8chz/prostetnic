document.getElementById("search").focus(); // kludge b/c SDK tabs don't seem to honor 'autofocus' attribute

document.getElementById("commit").addEventListener("click", function (event)
 {
  var headingStyle = document.getElementById("heading").style;
  self.port.emit(
   "newStyle",
   "background-color:"+headingStyle.backgroundColor+";color:"+headingStyle.color
  );
});

self.port.on("logStyle", function (style) {
  document.getElementById("heading").setAttribute("style", style);
});


