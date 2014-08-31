document.getElementById("commit").addEventListener("click", function (event)
 {
  var headingStyle = document.getElementById("heading").style;
  console.log("about to emit: "+"background-color:"+headingStyle.backgroundColor+";color:"+headingStyle.color);
  self.port.emit(
   "newStyle",
   "background-color:"+headingStyle.backgroundColor+";color:"+headingStyle.color
  );
});

self.port.on("logStyle", function (style) {
  document.getElementById("heading").setAttribute("style", style);
  console.log("style logged");
});


