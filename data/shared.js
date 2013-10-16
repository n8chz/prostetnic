// restoreHilites is called
// from the listener for the
// "reHilite" event
// which is emitted from the page-mod
// in "main.js"

function restoreHilites(hilites) {
    var bni, rangeToHilite, startContainer, endContainer;
    // // console.log(JSON.stringify(hilites));
    for each (var hilite in hilites) {
        bni = boundaryNodeIndices(hilite.textContent, document.body); // document is null????
        // console.log(JSON.stringify(bni));
        if (bni) {
            rangeToHilite = document.createRange();
            startContainer = bni.nodes[bni.startNodeIndex];
            endContainer = bni.nodes[bni.endNodeIndex];
            if (startContainer && endContainer) {
                // console.log("startContainer: "+JSON.stringify(startContainer)+"\nindex = "+bni.startNodeIndex);
                // console.log("endContainer: "+JSON.stringify(endContainer)+"\nindex = "+bni.endNodeIndex);
                rangeToHilite.setStart(startContainer, bni.startCharIndex);
                rangeToHilite.setEnd(endContainer, bni.endCharIndex);
                window.style = hilite.style;
                console.log(JSON.stringify(hilite.hiliteSpans));
                // window.serialno = +hilite.hiliteSpans[0].hiliteSpanId; // ?
                hiliteRange(rangeToHilite, hilite);
            }
        }
    }
}

// "reHilite" event emitted when a page
// is attached to the page-mod in "main.js"
// i.e. when any tab is opened or refreshed
self.port.on("reHilite", function (hilitesJson) {
    // // console.log("reHilite activated");
    restoreHilites(JSON.parse(hilitesJson));
});


self.port.on("undoHilite", function (hiliteSpansJson) {
    //alert(hiliteSpansJson);
    var hiliteSpans = JSON.parse(hiliteSpansJson);
    for (k = 0; k < hiliteSpans.length; k++) {
        element = document.getElementById(hiliteSpans[k]);
        if (element !== null) {
            element.removeAttribute("style");
        } else {
            // // console.log(hiliteSpans[k]+" not found (undoHilite)");
        }
    }
});

self.port.on("erase", function (idListJson) {
    // // console.log("erasing spans: "+JSON.stringify(idList));
    var idList = JSON.parse(idListJson);
    for each(var id in idList) {
        // // console.log(id);
        unhiliteElement = document.getElementById(id);
        if (unhiliteElement) {
            unhiliteElement.removeAttribute("style");
            // // console.log("style attribute removed from id h"+id);
        } else {
            // // console.log(id+" not found (erase)");
        }
    }
});


function hiLite() { //constructor for hiLite objects
    // var currently=new Date();
    this.timeStamp = Math.round((new Date()).getTime() / 1000);
    this.url = location.href;
    this.title = document.title;
    this.hiliteSpans = [];
}

// constructor for hiliteSpan objects

function hiliteSpan(spanClass, text, start, end) {
    // spanClass: 0, 1, 2 or 3
    // 0th order bit set if end of span is before end of node, clear if not
    // 1st order bit set if start of span is after start of node, clear if not
    this.spanClass = spanClass;
    this.textContent = text;
    this.startOffset = start;
    this.endOffset = end;
}


// Used when the selection includes multiple nodes;
// passing the commonAncestor of the 
// nodes containing the 2 endpoints
// of the selection.

function flatten(node) { // array of "leaf" subnodes in order of appearance.
    if (!node) {
        // // console.log("null object passed to flatten as node");
        return [];
    }
    if (node.hasChildNodes()) {
        var brood = node.childNodes;
        var familySize = brood.length;
        var returnValue = [];
        for (var k = 0; k < familySize; k++) {
            returnValue = returnValue.concat(flatten(brood[k]));
        }
        return (returnValue);
    } else if (node.nodeType == Node.TEXT_NODE) {
        return ([node]);
    } else return ([]);
}




function hilitePartialNode(node, startOffset, endOffset, prevHilite) {
    if (endOffset == 0) return null;
    // spanClass: 0, 1, 2 or 3
    // 0th order bit set if end of span is before end of node, clear if not
    // 1st order bit set if start of span is after start of node, clear if not
    var textContent = "";
    spanClass = endOffset ? 1 : 0;
    spanClass |= startOffset ? 2 : 0;
    var value = new hiliteSpan(spanClass, "", startOffset, endOffset);
    value.hiliteSpanId = window.serialno;
    window.serialno=+window.serialno+1;
    if (!node) return value;
    var parent = node.parentNode;

    if (!node.textContent.match(/\S/)) {
        value.textContent = node.textContent;
        return value;
    };

    if (endOffset) { // node is the end container
        var afterHilite = node.splitText(endOffset);
    }

    if (startOffset) { // node is the start container
        var hlText = node.splitText(startOffset);
    } else { // node is between the two ends of the range
        var hlText = node;
    }
    if (!parent) {
        return null; // this is a total kludge
    }
    if (hlText) { // this is a kludge
        if (prevHilite) {
            for each (var span in prevHilite.hiliteSpans) {
                if (span.textContent == hlText.textContent) {
                    value.hiliteSpanId = span.hiliteSpanId;
                    break;
                }
            }
        }
        value.textContent = hlText.textContent;
        var hlElement = document.createElement("span");
        hlElement.textContent = hlText.textContent;
        parent.replaceChild(hlElement, hlText);
        var styleAttributes = style.split(";");
        var background = styleAttributes[0].split(":")[1];
        var color = styleAttributes[1].split(":")[1];
        hlElement.style.background = background;
        hlElement.style.color = color;
        // // console.log(hlElement.outerHTML);
        hlElement.setAttribute("id", value.hiliteSpanId);
        hlElement.setAttribute("class", "prostetnic");
    } else { // let's study cases that fall through
        return null;
    }

    parent.normalize();
    // // console.log("Newly created hiliteSpan object: "+JSON.stringify(value));
    return value;
}


// Return the location of the string xString in the element xElement.
// This location includes the following information:
//  Which text node contains the beginning of xString (startNodeIndex)
//  Where in the node it ends (endCharIndex)  
//  Which text node contains the end of xString (endNodeIndex)
//  Where in the node it ends (endCharIndex)
// This information is returned in an object.

function boundaryNodeIndices(xString, xElement) {
    var nodes = flatten(xElement);
    var boundaryPoints = [0];
    var nodeTexts = nodes.map(function (node) {
        return node.textContent
    });
    var combinedText = nodeTexts.join("");
    for each(nodeText in nodeTexts) {
        boundaryPoints.unshift(boundaryPoints[0] + nodeText.length);
    }
    boundaryPoints.reverse();
    // // console.log(JSON.stringify(boundaryPoints));
    // // console.log("startPoint should be "+combinedText.indexOf(xString));
    var startPoint = combinedText.indexOf(xString);
    if (startPoint == -1) return null;
    // // console.log("startPoint is "+startPoint);
    // // console.log("combinedText: "+charCodes(combinedText));
    // // console.log("xString: "+charCodes(xString));
    if (combinedText == xString) startPoint = 0; // bug in Firefox?
    // if (startPoint == -1) return null;
    var endPoint = startPoint + xString.length;
    // // console.log(startPoint+"-"+endPoint);
    for (var k = 0; k < boundaryPoints.length && startPoint > boundaryPoints[k]; k++);
    var startNodeIndex = k - 1;
    var startCharIndex = startPoint - boundaryPoints[startNodeIndex];
    for (var j = k; j < boundaryPoints.length && endPoint > boundaryPoints[j]; j++);
    var endNodeIndex = j - 1;
    var endCharIndex = endPoint - boundaryPoints[endNodeIndex];
    return {
        nodes: nodes,
        startNodeIndex: startNodeIndex,
        startCharIndex: startCharIndex,
        endNodeIndex: endNodeIndex,
        endCharIndex: endCharIndex
    };
}

function hiliteRange(range, prevHilite) { // optional param: prevHilite
    var spans = [];
    var rangeText = range.toString();
    var bni = boundaryNodeIndices(rangeText, range.commonAncestorContainer);
    var nodes = bni.nodes;
    var sni = bni.startNodeIndex;
    var sci = bni.startCharIndex;
    var eni = bni.endNodeIndex;
    var eci = bni.endCharIndex;
    if (sni == eni) {
        spans.push(hilitePartialNode(nodes[sni], sci, eci, prevHilite));
    } else {
        spans.push(hilitePartialNode(nodes[sni], sci, null, prevHilite));
        for (var k = sni + 1; k <= eni - 1; k++) {
            spans.push(hilitePartialNode(nodes[k], null, null, prevHilite));
        }
        spans.push(hilitePartialNode(nodes[eni], null, eci, prevHilite));
    }
    return spans;
}


function hilite() {
    underlineLinks();
    var selection = document.getSelection();
    var spans = [];
    for (var k = 0; k < selection.rangeCount; k++) {
        range = selection.getRangeAt(k);
        spans = spans.concat(hiliteRange(range));
    }
    selection.removeAllRanges();
    var hl = new hiLite();
    hl.hiliteSpans = spans;
    // hl.serialno=window.serialno;
    // // console.log(JSON.stringify(hl));
    // hl.serialno = window.serialno;
    return hl;
};


// 

function undo(stack) {
    var lastSpan = stack.pop();
    var lastHilite = stack[stack.length - 1];
    while (lastSpan !== lastHilite) {
        // // console.log(lastSpan);
        e = document.getElementById((lastSpan--));
        if (e !== null) {
            e.setAttribute("style", e.getAttribute("style").replace(/background.*$/, ""));
        }
    }
    return (stack);
}

function underlineLinks() {
    var styleElement = document.getElementById("prostetnic-restore-underlining");
    if (styleElement == null) {
        styleElement = document.createElement("style");
        styleElement.setAttribute("id", "prostetnic-restore-underlining");
        styleElement.innerHTML = "a .prostetnic {text-decoration:underline;}";
        document.head.appendChild(styleElement);
    }
}

// Done with object and function definitions
