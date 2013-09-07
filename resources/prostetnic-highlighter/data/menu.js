// Picks up styleAttribute from
// context-menu cm's data property,
// then highlights the selection(s),
// then posts the stringified hiLite object
// back to the add-on script.
self.on("click",function (contextNode,infopak) {
//  alert(infopak);
  info=JSON.parse(infopak);
  window.style=info.style;
  window.serialno=+info.serialno;
  self.postMessage(JSON.stringify(hilite()));
});

/*
self.port.on("setcolor",function (style) {
  window.style=styleAttribute;
  if (document.getSelection()) {
   self.postMessage(JSON.stringify(hilite()));
  }
})
*/