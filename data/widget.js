document.onclick = function () {
  // console.log("'A' button clicked");
  self.postMessage();  
};

self.port.on("changeColor", function (style) {
  // console.log("changeColor event fired");
  var styleAttributes = style.split(";");
  var background = styleAttributes[0].split(":")[1];
  var color = styleAttributes[1].split(":")[1];
  // console.log("background: "+background+"\ncolor: "+color);
  var buttonStyle = document.getElementById("button").style;
  buttonStyle.background = background;
  buttonStyle.color = color;
});

