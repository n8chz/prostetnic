
// restoreHilites is called
// from the listener for the
// "reHilite" event
// which is emitted from the page-mod
// in "main.js"
function restoreHilites(hilites) {
 for (j=0; j<hilites.length; j++) {
  // window.find is deprecated :-(
  // https://bugzilla.mozilla.org/show_bug.cgi?id=672395
  // Will be looking for an alternative solution
  if (hilites[j].textContent.length>0)
   window.find(hilites[j].textContent,false,false,false,false,false,false);
  // style is a string
  // which fills the style attribute
  // of the span element
  // containing highlighted text.
  // It is stored as a property of
  // the window object here in
  // the content script,
  // and in the simple-storage object 'ss'
  // over on the add-on script side.
  window.style=hilites[j].style;
  window.serialno=hilites[j].hiliteId;  // Why not hiliteSpanId ???
  hilite();
 }
}

// "reHilite" event emitted when a page
// is attached to the page-mod in "main.js"
// i.e. when any tab is opened or refreshed
self.port.on("reHilite",function (spansJson) {
  restoreHilites(JSON.parse(spansJson));
});


self.port.on("undoHilite",function (hiliteSpansJson) {
  //alert(hiliteSpansJson);
  var hiliteSpans=JSON.parse(hiliteSpansJson);
  for (k=0; k<hiliteSpans.length; k++) {
   element=document.getElementById("h"+hiliteSpans[k]);
   if (element !== null) {
    element.removeAttribute("style");
   }
  }
});

self.port.on("eraseHilites",function (spanIdsJson) {
  spanIds=JSON.parse(spanIdsJson);
  while (id=spanIds.shift()) {
   element=document.getElementById("h"+id);
   if (element !== null) {
    element.removeAttribute("style");
   }
  }
});

function hiLite() { //constructor for hiLite objects
// var currently=new Date();
 this.timeStamp=Math.round((new Date()).getTime()/1000);
 this.url=location.href;
 this.hiliteSpans=[];
}

// constructor for hiliteSpan objects
function hiliteSpan(spanClass,text,start,end) { 
// spanClass: 0, 1, 2 or 3
// 0th order bit set if end of span is before end of node, clear if not
// 1st order bit set if start of span is after start of node, clear if not
 this.spanClass=spanClass;
 this.textContent=text;
 this.startOffset=start;
 this.endOffset=end;
}

// Used when the selection includes multiple nodes;
// passing the commonAncestor of the 
// nodes containing the 2 endpoints
// of the selection.
function flatten(node) { // array of text subnodes in order of appearance.
 if (node.hasChildNodes()) {
  var brood=node.childNodes;
  var familySize=brood.length;
  var returnValue=[];
  for (var k=0; k<familySize; k++) {
   returnValue=returnValue.concat(flatten(brood[k]));
  }
  return (returnValue);
 }
 else if (node.nodeType === 3 && node.textContent.search(/\S/) !== -1)
  // 3 indicates a text node
  return ([node]);
 return ([]);
}

function hiliteBetween(hiliteObject,nodeList,anchor,focus) { // nodeList:array of those nodes 2b highlighted in entirety
 while ((q=nodeList.shift()) && q!==anchor);
 while ((q=nodeList.shift()) && q!==focus) {
   if (q.nodeType === 1) { // q is an element
    nodeHilite(q);
    hiliteObject.hiliteSpans.push(new hiliteSpan(0,q.textContent,0,q.textContent.length))
   }
   else {
    e=document.createElement("span");
    nodeHilite(e);
    e.textContent=q.textContent;
    q.parentNode.replaceChild(e,q)
    hiliteObject.hiliteSpans.push(new hiliteSpan(0,e.textContent,0,e.textContent.length));
   }
 }
}

function withinNode (node,left,right) { //call this if anchorNode===focusNode
 aParent=node.parentNode;
 text=node.textContent;
 before=text.substring(0,left);
 during=text.substring(left,right);
 after=text.substr(right);
 afterElement=document.createElement("span");
 duringElement=document.createElement("span");
 beforeElement=document.createElement("span");
 afterElement.textContent=after;
 duringElement.textContent=during;
 beforeElement.textContent=before;
// duringElement.setAttribute("style",window.style);
 nodeHilite(duringElement);
 aParent.replaceChild(afterElement,node);
 aParent.insertBefore(duringElement,afterElement);
 aParent.insertBefore(beforeElement,duringElement);
 return(new hiliteSpan(3,during,left,right));
}

function hiliteStart(node,offset) { //call this if anchorNode !== focusNode
 aParent=node.parentNode;
 text=node.textContent;
 before=text.substring(0,offset);
 during=text.substr(offset);
// alert(before+"\n\n"+during);
 duringElement=document.createElement("span");
// beforeElement=document.createElement("span");
 beforeNode=node.cloneNode(false);
 beforeNode.textContent=before;
 duringElement.textContent=during;
// beforeElement.textContent=before;
// duringElement.setAttribute("style",window.style);
 nodeHilite(duringElement);
// aParent.replaceChild(duringElement,node);
// aParent.insertBefore(beforeElement,duringElement);
 aParent.replaceChild(duringElement,node);
 aParent.insertBefore(beforeNode,duringElement);
 return(new hiliteSpan(2,during,offset,text.length))
}

function hiliteEnd(node, offset) { // call this one too, if 2 different nodes
 aParent=node.parentNode;
 text=node.textContent;
 during=text.substring(0,offset);
 after=text.substr(offset);
// afterElement=document.createElement("span");
 node.textContent=after;
 duringElement=document.createElement("span");
// afterElement.textContent=after;
 duringElement.textContent=during;
// duringElement.setAttribute("style",window.style);
 nodeHilite(duringElement);
// aParent.replaceChild(afterElement,node);
// aParent.insertBefore(duringElement,afterElement);
 aParent.insertBefore(duringElement,node);
 return(new hiliteSpan(1,during,0,offset));
}

function hiliteParagraph(node) {
// node.setAttribute("style",window.style);
 nodeHilite(node);
 var text1=document.getSelection().toString();
 return (new hiliteSpan(4,text1,0,text1.length));
}

// Hilight the current selection(s)
// using the background and text color
// stored in window.style
function hilite() {
 var currentHilite=new hiLite();
 window.currentHilite=currentHilite;
 while ((selection=document.getSelection()).rangeCount) {
  var thisRange=selection.getRangeAt(0);
  var leftNode=thisRange.startContainer;
  var rightNode=thisRange.endContainer;
  var leftOffset=thisRange.startOffset;
  var rightOffset=thisRange.endOffset;
  //alert("leftOffset: "+leftOffset+"\nrightOffset: "+rightOffset);
  if (leftNode===rightNode) {
   if (leftNode.nodeType === 1) {
    currentHilite.hiliteSpans.push(hiliteParagraph(leftNode));
   }
   else currentHilite.hiliteSpans.push(withinNode(leftNode,leftOffset,rightOffset));
  }
  else {
   var nodeList=flatten(thisRange.commonAncestorContainer);
   currentHilite.hiliteSpans.push(hiliteStart(leftNode,leftOffset));
   hiliteBetween(currentHilite,nodeList,leftNode,rightNode);
   currentHilite.hiliteSpans.push(hiliteEnd(rightNode,rightOffset));
  }
  selection.removeRange(thisRange);
 }
// if (typeof window.sessionHilites !== "undefined")
//  window.sessionHilites=window.sessionHilites.push(currentHilite);
// else
//  window.sessionHilites=[currentHilite];
 currentHilite.serialno=window.serialno;
 return (currentHilite);
}

function nodeHilite(node) {
 if (id=node.getAttribute("id") === null || id === "") {
  window.serialno=+window.serialno+1;
  node.setAttribute("id","h"+window.serialno);
 }
// alert("nodeHilite:serialno="+window.serialno);
 node.setAttribute("style",node.getAttribute("style")+";"+window.style);
}


function undo(stack) {
// alert("Entered undo() function");
 var lastSpan=stack.pop();
 var lastHilite=stack[stack.length-1];
 while (lastSpan !== lastHilite) {
  e=document.getElementById("h"+(lastSpan--));
  if (e !== null) {
   e.setAttribute("style",e.getAttribute("style").replace(/background.*$/,""));
  }
 }
 return (stack);
}

// Done with object and function definitions

