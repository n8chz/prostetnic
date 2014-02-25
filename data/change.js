/* not ready to implement this feature yet

self.on("click", function() {
  // var currSel = document.getSelection();
  console.log("node text:"+document.getSelection().focusNode.textContent);
  var currNode = document.getSelection().focusNode;
  while (currNode != document
         || currNode.nodeType != Node.ELEMENT_NODE
         || currNode.getAttribute("class") == "prostetnic") {
   currNode = currNode.parentNode;
  }
  self.postMessage(currNode.getAttribute("id"));
});

*/

