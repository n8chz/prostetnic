var cm=require("sdk/context-menu");
// var request = require("sdk/request");
var self=require("sdk/self");
var data = self.data;
var pageMod = require("sdk/page-mod");
var ss = require("sdk/simple-storage");
var widget = require("sdk/widget");
var tabs = require("sdk/tabs");
var panel = require("sdk/panel");
var simplePrefs = require("sdk/simple-prefs");
var { Hotkey } = require("sdk/hotkeys");

dbinit=require("dbinit");
hlutils=require("hlutils");

// establish default highlighter color
if (typeof ss.storage.style === "undefined")
 ss.storage.style="background:#FFEFBF; color:#000000";
 

//if (typeof ss.storage.serialno === "undefined")
// ss.storage.serialno=1;

ss.storage.serialStack=[];

exports.ss=ss;



// see https://developer.mozilla.org/en/Storage
// see also http://stackoverflow.com/a/12589707/1269964

var {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");  
Cu.import("resource://gre/modules/FileUtils.jsm");


// dbInit() Should only execute
// only the first time this add-on runs following installation
// see
// https://minghuasweblog.wordpress.com/2011/08/21/firefox-extension-javascript-access-local-file/
 let file = FileUtils.getFile("ProfD", ["patma.sqlite"]);
// if (!file.exists())
 var dbConn=dbinit.dbInit(file);
 exports.dbConn=dbConn;
// else
//  dbConn = Services.storage.openDatabase(file);

// support functions for addon-kit objects

// definitions of addon-kit objects
 
// fetch url

pageMod.PageMod({ 
  include: ["*"],
  contentScriptWhen: "ready",
  contentScriptFile: [data.url("shared.js")],
  onAttach:function (worker) {
     url=tabs.activeTab.url;
     //self.currMax=worker.port.emit("chk4frame",0).currMax;
     if (hlutils.beenHereBefore(dbConn,url)) {
      // // console.log("been here before");
      // restore previous highlights for this page
      // listener for reHilite is in shared.js
      worker.port.emit("reHilite",JSON.stringify(hlutils.serializeHilite(dbConn,url)));
     }
     hlutils.nextSpanId(dbConn);
     item.data=JSON.stringify(ss.storage);
  }
});



// The following is added to make all features available from right mouse menus
// as requested by Nick2222 https://addons.mozilla.org/en-US/firefox/addon/prostetnic/reviews/408424/

var phMenu = cm.Menu({
  label: "Prostetnic Highlighter",
  image: data.url("hlmenu.ico"), // h/t http://commons.wikimedia.org/wiki/File:Faber-Castell-pens2.jpg
  context: cm.URLContext("*"), // a kludge
  items: [
   selectColorItem = cm.Item({
     label: "Select highlighter color (c-alt-a)",
     image: data.url("colsel.ico"),
     context: cm.URLContext("*"),
     contentScriptFile: data.url("dummy.js"),
     onMessage: toggleColorPanel
   }),
   undoItem = cm.Item({
     label: "Undo most recent hilight (c-alt-z)",
     image: data.url("hlundo.ico"), // h/t http://commons.wikimedia.org/wiki/File:Oxygen480-actions-edit-undo.svg
     context: cm.URLContext("*"),
     contentScriptFile: data.url("dummy.js"),
     onMessage: executeUndo
   }),
   eraseItem = cm.Item({
     label: "Erase all highlights on this page (c-alt-n)",
     image: data.url("hlerase.ico"), // http://commons.wikimedia.org/wiki/File:Pelikan_Radiergummi.jpg
     context: cm.URLContext("*"),
     contentScriptFile: data.url("dummy.js"),
     onMessage: executeErase
   }),
   searchItem = cm.Item({
     label: "Search text of previous highlights (c-alt-f)",
     image: data.url("hlsearch.ico"), // h/t http://commons.wikimedia.org/wiki/File:Fernglas%28alt%29.JPG
     context: cm.URLContext("*"),
     contentScriptFile: data.url("dummy.js"),
     onMessage: toggleSearchPanel
   })
  ]
});

// context menu for highlighting text
 var item=cm.Item({ //create menu item for highlighter
   label:"Highlight selected text (c-alt-h)",
   context:cm.SelectionContext(),
   contentScriptWhen:"start",
   data:JSON.stringify(ss.storage),
   contentScriptFile:[data.url("shared.js"),data.url("menu.js")],
   // when content script finishes highlighting
   // record details in DB:
   onMessage:newHilitesIn
 });
 
 exports.item=item;

 
// widget for selecting highlighter color:
 var selectColor=widget.Widget({
   id: "cealed",
   label: "Select highlighter color, and highlight selection, if any (c-alt-a)",
   contentURL:data.url("colsel.ico"),
   onClick: toggleColorPanel
 });
 
 
// content property for selectColor widget

var selectColorContentLeft="<div style=\"height: 100%; text-align: center;"+
   " vertical-align:middle; cursor:default;";
var selectColorContentRight="\">A</div>";

// widget for highlighting selected text: 
function activeTabWorker() {
 return tabs.activeTab.attach({
   contentScriptFile: [data.url("now.js"), data.url("shared.js")],
   onMessage: newHilitesIn
 });
}

var hiliteNowWidget = widget.Widget({
  id: "hiliteNow",
  label: "Highlight selection in this color (c-alt-h)",
  contentURL: data.url("widget.html"),
  contentScriptFile: data.url("widget.js"),
  onMessage: function () {
   var worker = activeTabWorker();
   worker.port.emit("hiliteNow", JSON.stringify(ss.storage));
  }
});

hiliteNowWidget.port.emit("changeColor", ss.storage.style);

// panel for selecting highlighter color
 var colorPanel = panel.Panel({
   height:450,
   width:350,
   contentURL: data.url("colors.html"),
   contentScriptFile: [data.url("shared.js"),data.url("getcolor.js")]
 });
 
 // see click listener in "getcolor.js"
 // highlighter color has been changed
 // save this change to simple storage.
 colorPanel.port.on("color-sel", function(msg) {
   colorPanel.hide();
   ss.storage.style=msg;
   // Following 2 lines removed to clear objection raised by AMO reviewer:
   // hiliteNow.content=
   // selectColorContentLeft+ss.storage.style+selectColorContentRight;
   // Prev. 2 lines replaced with:
   // console.log(hiliteNowWidget.contentScriptFile);
   hiliteNowWidget.port.emit("changeColor", ss.storage.style);
   // console.log("oy");
   item.data=JSON.stringify(ss.storage); // Is assignment to data prop. of context-menu ok?
   /*
   worker=tabs.activeTab.attach({
     contentScriptFile:[data.url("shared.js"),data.url("now.js")],
     onMessage: newHilitesIn
   });
   */
   worker = activeTabWorker();
   worker.port.emit("hiliteNow", JSON.stringify(ss.storage));
 });


 var undo=widget.Widget({
   id:"cating",
   label:"undo most recent highlight (c-alt-z)",
   contentURL: data.url("hlundo.ico"),
   onClick: executeUndo
 });

 var erase=widget.Widget({
   id:"magated",
   label:"erase all highlights in current tab (c-alt-n)",
   // bug: most recent highlight doesn't disappear
   contentURL: data.url("hlerase.ico"),
   contentScriptWhen:"start",
   contentScriptUrl:data.url("shared.js"),
   onClick:executeErase
 });

 /* Set up widget and panel for database searches */
 var searchPanel=panel.Panel({
   height:610,
   width:987,
   contentURL:data.url("search.html"),
   contentScriptFile:[data.url("search.js")],
   contentScriptWhen:"start"
 });

 var searchWidget=widget.Widget({
   id:"searchWidget",
   label:"search for words in previously highlighted passages (c-alt-f)",
   contentURL: data.url("hlsearch.ico"),
   onClick: toggleSearchPanel
 });

 searchPanel.on("show", function() {
   searchPanel.port.emit("show");
 });

 searchPanel.port.on("searchtext", function (wordsJson) {
   searchPanel.port.emit("matchingPages",JSON.stringify(hlutils.matchingPages(wordsJson)));
 })

 // set ss.storage.serialno to next hilitespanid to be assigned
 hlutils.nextSpanId(dbConn);

// hotkeys

 
var hiliteNowHotKey = Hotkey({
  combo: simplePrefs.prefs["hiliteNowCombo"],
  onPress: function () {
   var worker = activeTabWorker();
   worker.port.emit("hiliteNow", JSON.stringify(ss.storage));
  }
});

function initHotKeys() {

 var selectColorHotKey = Hotkey({
   combo: simplePrefs.prefs["selectColorCombo"],
   onPress: toggleColorPanel
 });

 var undoHotKey = Hotkey({
   combo: simplePrefs.prefs["undoCombo"],
   onPress: executeUndo
 });

 var eraseHotKey = Hotkey({
   combo: simplePrefs.prefs["eraseCombo"],
   onPress: executeErase
 });

 var searchHotKey = Hotkey({
   combo: simplePrefs.prefs["searchCombo"],
   onPress: toggleSearchPanel
 });
}

initHotKeys();


simplePrefs.on("", function (prefName) {
  var keyCombo = simplePrefs.prefs[prefName];
  try {
   initHotKeys();
  }
  finally {
   switch (prefName) {
    case "hiliteNowCombo":
     item.label = item.label.replace(/(.*)\((.*)\)/, "$1("+keyCombo+")");
     break;
    case "selectColorCombo":
     selectColorItem.label = selectColorItem.label.replace(/(.*)\((.*)\)/, "$1("+keyCombo+")");
     break;
    case "undoCombo":
     undoItem.label = undoItem.label.replace(/(.*)\((.*)\)/, "$1("+keyCombo+")");
     break;
    case "eraseCombo":
     eraseItem.label = eraseItem.label.replace(/(.*)\((.*)\)/, "$1("+keyCombo+")");
     break;
    case "searchCombo":
     searchItem.label = searchItem.label.replace(/(.*)\((.*)\)/, "$1("+keyCombo+")");
     break;
   }
  }
});

// end hotkeys


// reusable functions for use as onMessage property of various SDK objects

function newHilitesIn(hilitesJson) {
 var hilites = JSON.parse(hilitesJson);
 ss.storage.serialno = hilites.serialno;
 hlutils.postToSqlite(dbConn, hilites); // remember to make relevant change in postToSqlite() !!!
}

function toggleColorPanel() {
 colorPanel.isShowing ? colorPanel.hide() : colorPanel.show();
}

function executeUndo () {
 var spanIds=hlutils.postUndo(dbConn);
 worker=tabs.activeTab.attach({
   contentScriptWhen:"start",
   contentScriptFile:[data.url("shared.js")]
 });
 worker.port.emit("undoHilite",JSON.stringify(spanIds));
}

function executeErase () {
 eraseWorker=tabs.activeTab.attach({
   contentScriptWhen:"start",
   contentScriptFile:[data.url("shared.js")]
 });
 idList=hlutils.eraseQuery(dbConn,tabs.activeTab.url);
 eraseWorker.port.emit("erase",JSON.stringify(idList));
}

function toggleSearchPanel () {
 searchPanel.isShowing ? searchPanel.hide() : searchPanel.show();
}


// end reusable functions

