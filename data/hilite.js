var HiliteScript = (function () {

  // Event listeners for content scripts:

  self.port.on("hilite", function (dataJSON) {
    console.log("hilite signal received with: "+dataJSON);
    var data = JSON.parse(dataJSON);

    self.port.emit("done", JSON.stringify(new Highlight(data)));
  });

  self.on("click", function (contextNode, dataJSON) {
    // console.log("hilite signal received with: "+dataJSON);
    var data = JSON.parse(dataJSON);

    self.postMessage(JSON.stringify(new Highlight(data)));
  });

  self.port.on("reHilite", function (hilitesJSON) {
    // console.log("reHilite: hilitesJSON: "+hilitesJSON);
    var hilites = JSON.parse(hilitesJSON);
    var rhs = new ReHiliteSession(hilites);
  });

  // Classes for content scripts:

  function ReHiliteSession(hilites) {
   // Create a NodeIterator containing all non-whitespace text nodes in document.body:
   var iterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_TEXT,
    function (node) {
     return node.textContent.match(/\S/) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
   );
   // Convert the NodeIterator to an Array of Strings:
   this.allTextNodes = [];
   var node;
   while (node = iterator.nextNode()) {
    this.allTextNodes.push(node);
   }
   var session = this;
   hilites.forEach(function (hilite) {
     session.reHilite(hilite);
   });
  }

  ReHiliteSession.prototype = {

   reHilite: function (hilite) {
    var relevantTextNodes = this.rightmostMatch(hilite);
    if (relevantTextNodes) {
     var unusedNodes = this.allTextNodes.slice(0, -relevantTextNodes.length);
     var event = this;
     var newNodes = [];
     var session = this;
     var hiliteString = hilite.hiliteSpans.map(function (x) {
       return x.textContent;
     }).join("");
     var before = this.texts(this.allTextNodes).join("");
     
     hilite.hiliteSpans.forEach(function (hiliteSpan) {
       newNodes = session.hilite(hiliteSpan, relevantTextNodes.shift(), hilite.style);
       session.allTextNodes = unusedNodes.concat(newNodes).concat(relevantTextNodes);
     });
     // change allTextNodes to relect changes
     var after = this.texts(this.allTextNodes).join("");
     if (before == after) {
      console.log("that went well");
     }
     else {
      console.log("that did NOT go well");
      console.log("before.length: "+before.length);
      console.log("after.length: "+after.length);
     }
    }
    else {
     console.log("Can't find hilite in document: "+JSON.stringify(hilite));
    }
   },

   rightmostMatch: function (hilite) {
    var spanTexts = this.texts(hilite.hiliteSpans);
    var spanTextCount = spanTexts.length;
    var nodeTexts = this.texts(this.allTextNodes);
    var hiliteText = spanTexts.join("");
    var nodeSlice, sliceText, startOffset;
    for (var k = -spanTextCount; k > -nodeTexts.length; k--) {
     nodeSlice = nodeTexts.slice(k, k+spanTextCount);
     sliceText = nodeSlice.join("");
     startOffset = sliceText.indexOf(hiliteText);
     if (startOffset != -1) {
      // console.log("found \""+hiliteText+"\" in \""+sliceText+"\"");
      return this.allTextNodes.slice(k);
     }
    }
    // console.log("Not found in document: "+hiliteText);
    return null;
   },

   texts: function (array) {
    return array.map(function (item) {
      return item.textContent;
    });
   },

   hilite: function(span, node, style) {
    var spanText = span.textContent;
    var nodeText = node.textContent;
    var nodeSplit = nodeText.split(spanText);
    var right = nodeSplit.pop();
    var left = nodeSplit.join(spanText);
    var parent = node.parentNode;
    var newNodes = [];
    if (left) {
     newNodes.push(this.insert(left, node));
    }
    var newElement = document.createElement("span");
    newElement.setAttribute("class", "prostetnic");
    newElement.setAttribute("style", style);
    newElement.textContent = spanText;
    newElement.id = span.hiliteSpanID;
    parent.insertBefore(newElement, node);
    newNodes.push(newElement.firstChild);
    if (right) {
     newNodes.push(this.insert(right, node));
    }
    console.log("old node text:\n"+nodeText);
    console.log("new nodes text:\n"+this.texts(newNodes).join(""));
    parent.removeChild(node);
    return newNodes;
   },

   insert: function(text, node) {
    var newNode = document.createTextNode(text);
    node.parentNode.insertBefore(newNode, node);
    return newNode;
   }

  };



  function Highlight(data) { // TODO make Highlight instances per range rather than per selection
   this.style = data.style;
   var hiliteSpanID = data.hiliteSpanID;
   this.timeStamp = Math.round((new Date()).getTime() / 1000);
   this.url = location.href;
   this.title = document.title;
   this.hiliteSpans = [];
   var selection = document.getSelection();
   for (var k = 0; k < selection.rangeCount; k++) { // selections may be non-contiguous
    this.hiliteSpans = this.hiliteSpans.concat(
     this.highlightRange(selection.getRangeAt(k), hiliteSpanID)
    );
   }
   selection.removeAllRanges(); // once text is highlighted, it should no longer be selected.
   this.startContainer = this.endContainer = this.startOffset = this.endOffset = undefined;
  }

  Highlight.prototype = {

   highlightRange: function (range, hiliteSpanID) {
    console.log("entered highlightRange.  hiliteSpanID="+hiliteSpanID);
    var spans = [];
    this.startContainer = range.startContainer;
    this.startOffset = range.startOffset;
    this.endContainer = range.endContainer;
    this.endOffset = range.endOffset;
    var currentContainer = this.startContainer;
    var newSpan;
    // var nodeArray = this.flatten(range.commonAncestorContainer); // un-comment this to restore original behavior
    console.log("about to create node iterator");
    nodeIterator = document.createNodeIterator(
     range.commonAncestorContainer,
     NodeFilter.SHOW_TEXT,
     function (node) {
      console.log("about to check for intersection ("+range.intersectsNode(node)+")");
      return range.intersectsNode(node);
     }
    );
    console.log("node iterator created");
    var nodeArray = [];
    var node;
    while (node = nodeIterator.nextNode()) {
     nodeArray.push(node);
    }
    console.log("length of nodeArray: "+nodeArray.length);
/*
    if (nodeArray.length > 1) { // if there's only one node, then startContainer == endContainer
     nodeArray = nodeArray.filter(function (node) {
       return range.startContainer.compareDocumentPosition(node) != range.endContainer.compareDocumentPosition(node);
     });
    }
*/
/*
    for (var k=0; k<nodeArray.length; k++) {
     console.log(JSON.stringify({
        cdpStart: nodeArray[k].compareDocumentPosition(this.startContainer),
        cdpEnd: nodeArray[k].compareDocumentPosition(this.endContainer),
        textContent: nodeArray[k].textContent
     }));
    }
    console.log("nodeArray.length: "+nodeArray.length);
*/
/*
    for (var k = nodeArray.indexOf(this.startContainer); k <= nodeArray.indexOf(this.endContainer); k++) { // this will need to be re-worked.  
     if (nodeArray[k].nodeType = Node.TEXT_NODE && nodeArray[k].textContent.match(/\S/)) {
      spans.push(new HighlightSpan(this, nodeArray[k], hiliteSpanID++));
     }
    }
*/
    for each (var node in nodeArray) {
     if (node.nodeType = Node.TEXT_NODE && node.textContent.match(/\S/)) {
      spans.push(new HighlightSpan(this, node, hiliteSpanID++));
     }
    }
    return spans;
   }/*,

   flatten: function (node) {
    if (!node) {
     // // console.log("null object passed to flatten as node");
     return [];
    }
    if (node.hasChildNodes()) {
     var brood = node.childNodes;
     var familySize = brood.length;
     var returnValue = [];
     for (var k = 0; k < familySize; k++) {
      returnValue = returnValue.concat(this.flatten(brood[k]));
     }
     return (returnValue);
    } else if (node.nodeType == Node.TEXT_NODE) {
     return ([node]);
    } else return ([]);
   }
*/
  };

  function HighlightSpan(highlight, currentContainer, hiliteSpanID) {
   this.hiliteSpanID = hiliteSpanID;
   var text = currentContainer.textContent;
   var textLength = text.length;
   this.startOffset = currentContainer == highlight.startContainer ? highlight.startOffset : 0;
   this.endOffset = currentContainer == highlight.endContainer ? highlight.endOffset : textLength;
   this.textContent = text.substring(this.startOffset, this.endOffset);
   var left = text.substring(0, this.startOffset);
   var right = text.substring(this.endOffset, textLength);
   var parent = currentContainer.parentNode;
   var newNode;
   // Do DOM manipulation to make highlighting happen:
   if (left.length > 0) {
    newNode = document.createTextNode(left);
    parent.insertBefore(newNode, currentContainer);
   }
   newNode = document.createElement("span");
   newNode.textContent = this.textContent;
   newNode.setAttribute("style", highlight.style);
   newNode.id = hiliteSpanID;
   newNode.setAttribute("class", "prostetnic");
   parent.insertBefore(newNode, currentContainer);
   if (right.length > 0) {
    newNode = document.createTextNode(right);
    parent.insertBefore(newNode, currentContainer);
   }
   parent.removeChild(currentContainer);
  }

})();

