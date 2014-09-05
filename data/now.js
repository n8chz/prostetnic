// highlights the selection(s),
// then posts the stringified hiLite object
// back to the add-on script.
self.port.on("hiliteNow",function (infopak) {
  info=JSON.parse(infopak);
  window.style=info.style;
  window.serialno=+info.serialno;
  self.postMessage(JSON.stringify(hilite()));
});
