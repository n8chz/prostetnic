var cm=require("context-menu");
var request = require("request");
var self=require("self");
var data = self.data;
var pageMod = require("page-mod");
var {Cc, Ci} = require("chrome");
var ss = require("simple-storage");
var widget = require("widget");
var tabs = require("tabs");

// establish default highlighter color
if (typeof ss.storage.style === "undefined")
 ss.storage.style="background:#FFEFBF; color:#000000";

//if (typeof ss.storage.serialno === "undefined")
// ss.storage.serialno=1;

ss.storage.serialStack=[];

// see https://developer.mozilla.org/en/Storage

Components.utils.import("resource://gre/modules/Services.jsm");  
Components.utils.import("resource://gre/modules/FileUtils.jsm");  

// content property for selectColor widget

var selectColorContentLeft="<div style=\"height: 100%; text-align: center;"+
   " vertical-align:middle; ";
var selectColorContentRight="\">A</div>";


// Database schema
// for storage of info
// about user highlights

var createUrlTable=
"CREATE TABLE IF NOT EXISTS url("+
" urlid INTEGER PRIMARY KEY,"+
" url VARCHAR"+
")";

var createUrlIndex=
"CREATE UNIQUE INDEX IF NOT EXISTS urli ON url(url)";

var createHiliteTable= // this will also have a column for color of highlight
"CREATE TABLE IF NOT EXISTS hilite("+
" hiliteid INTEGER PRIMARY KEY,"+
" urlid INTEGER,"+
" ts INTEGER,"+
" style VARCHAR,"+
" FOREIGN KEY(urlid) REFERENCES url(urlid)"+
")";

var createTimestampIndex=
"CREATE INDEX IF NOT EXISTS tsi ON hilite(ts)";

var createHiliteSpanTable=
"CREATE TABLE IF NOT EXISTS hilitespan("+
" hilitespanid INTEGER PRIMARY KEY,"+
" hiliteid INTEGER,"+
" spanclass INTEGER,"+
" textcontent VARCHAR,"+
" startoffset INTEGER,"+
" endoffset INTEGER,"+
" FOREIGN KEY(hiliteid) REFERENCES hilite(hiliteid)"+
")";

var createWordTable=
"CREATE TABLE IF NOT EXISTS word("+
" wordid INTEGER PRIMARY KEY,"+
" word VARCHAR"+
")";

var createWordIndex=
"CREATE INDEX IF NOT EXISTS wordi ON word(word)";

var createWordInHiliteTable=
"CREATE TABLE IF NOT EXISTS wordinhilite ("+
" wordinhiliteid INTEGER PRIMARY KEY,"+
" hiliteid INTEGER,"+
" wordid INTEGER,"+
" FOREIGN KEY(hiliteid) REFERENCES hilite(hiliteid),"+
" FOREIGN KEY(wordid) REFERENCES word(wordid)"+
")";


var createHiliteIdIndex=
"CREATE INDEX IF NOT EXISTS hiliteidi ON wordinhilite(hiliteid)";

var createWordIdIndex=
"CREATE INDEX IF NOT EXISTS wordidi ON wordinhilite(wordid)";

function dbInit(file) {
 let dbConn = Services.storage.openDatabase(file); // Will also create the file if it does not exist  
 dbConn.executeSimpleSQL(createUrlTable);
 dbConn.executeSimpleSQL(createUrlIndex);
 dbConn.executeSimpleSQL(createHiliteTable);
 dbConn.executeSimpleSQL(createTimestampIndex);
 dbConn.executeSimpleSQL(createHiliteSpanTable);
 dbConn.executeSimpleSQL(createWordTable);
 dbConn.executeSimpleSQL(createWordIndex);
 dbConn.executeSimpleSQL(createWordInHiliteTable);
 dbConn.executeSimpleSQL(createHiliteIdIndex);
 dbConn.executeSimpleSQL(createWordIdIndex);
 return (dbConn);
}

// If attached page's url appears in db
// then we have highlights to restore
function beenHereBefore(dbConn,url) {
 var statement=dbConn.createStatement("SELECT urlid FROM url WHERE url=:url");
 statement.params.url=url;
 return (statement.executeStep());
}

// Fetch or create (as the case may be) value of urlid
// column pertaining to attached page's url
function getUrlKey(dbConn,url) {
 var statement=dbConn.createStatement("SELECT urlid FROM url WHERE url=:url");
 statement.params.url=url;
 if (statement.executeStep()) {
  return (statement.getString(0));
 }
 else { // url not already in url table
  statement=dbConn.createStatement("INSERT INTO url(url) VALUES (:url)");
  statement.params.url=url;
  statement.executeStep();
  statement=dbConn.createStatement("SELECT MAX(urlid) FROM url");
  statement.executeStep();
  return (statement.getString(0));
 }
}


function getWordId(dbConn, word) {
 var statement=dbConn.createStatement("SELECT wordid FROM word WHERE word=:word");
 statement.params.word=word;
 if (statement.executeStep()) return (statement.getString(0));
 else {
  statement=dbConn.createStatement("INSERT INTO word(word) values (:word)");
  statement.params.word=word;
  statement.executeStep();
  statement=dbConn.createStatement("SELECT MAX(wordid) FROM word");
  statement.executeStep();
  return (statement.getString(0));
 }
}

function updateDict(dbConn) {
 var code=
  "SELECT hiliteid, textcontent"+
  " FROM hilitespan"+
  " WHERE hiliteid NOT IN"+
  "(SELECT hiliteid FROM wordinhilite)";
 var statement=dbConn.createStatement(code);
 while (statement.executeStep()) {
  hiliteId=statement.getString(0);
  textContent=statement.getString(1);
  wordArray=textContent.split(/'?[^'0-9A-Za-z]+'?/);
  for (k=0; k<wordArray.length; k++) {
   statement=dbConn.createStatement("INSERT INTO wordinhilite(hiliteid, wordid) VALUES (:hiliteid, :wordid)");
   statement.params.hiliteid=hiliteId;
   statement.params.wordid=getWordId(dbConn, wordArray[k]);
  }
 }
}

/*
// Index all the words in hilight span
function postToDict(dbConn,hiliteId,hiliteSpan) {
 var tc=hiliteSpan.textContent;
 var wordArray=tc.split(/'?[^'0-9A-Za-z]+'?/);
 for (k=0; k<wordArray.length; k++) {
  word=wordArray[k].toLowerCase();
  if (word !== "") {
   statement=dbConn.createStatement("SELECT wordid FROM word WHERE word=:word");
   statement.params.word=word;
   if (statement.executeStep()) {
    wordId=statement.getString(0);
   }
   else 
   {
    // insert word into table 'word' if it's not already there
    statement=dbConn.createStatement("INSERT INTO word(word) VALUES (:word)");
    statement.params.word=word;
    statement.executeStep();
    statement=dbConn.createStatement("SELECT MAX(wordid) from word");
    statement.executeStep();
    wordId=statement.getString(0);
   }
   // create a record in 'wordinhilite' for new word
   statement=dbConn.createStatement("INSERT INTO wordinhilite(hiliteid, wordid) VALUES (:hiliteid, :wordid)");
   statement.params.hiliteid=hiliteId;
   statement.params.wordid=wordId;
   statement.executeStep();
   d = new Date();
  }
 }
}

*/

// Make a record of the highlight just rendered
// by hilite() in "shared.js".
// The parameters of this highlight
// are in selectionJson, which have been
// stringified for us by conext-menu cm's
// click listener.
function postToSqlite (dbConn,selectionJson) {
 var hiliteObject=JSON.parse(selectionJson);
 ss.storage.serialStack.push(hiliteObject.serialno);
 var urlKey=getUrlKey(dbConn,hiliteObject.url);
 var statement=
  dbConn.createStatement(
   "INSERT INTO hilite(urlid,ts,style) VALUES (:urlKey, :timeStamp, :style)");
 statement.params.urlKey=urlKey;
 statement.params.timeStamp=hiliteObject.timeStamp;
 statement.params.style=ss.storage.style;
 statement.executeStep();
 statement=dbConn.createStatement("SELECT MAX(hiliteid) FROM hilite");
 statement.executeStep();
 var hiliteId=statement.getString(0);
 for (var k=0; k<hiliteObject.hiliteSpans.length; k++) {
  // hiliteObject.hiliteSpans[k].textContent=hiliteObject.hiliteSpans[k].textContent.replace(/'/g,"''");
  // prev. line should be unnecessary w. bound parameters
  insertSpan="INSERT INTO"+
   " hilitespan(hiliteid,spanclass,textcontent,startoffset,endoffset)"+
   " VALUES (:hiliteId, :spanClass, :tc, :startOffset, :endOffset)";
  statement=dbConn.createStatement(insertSpan);
  statement.params.hiliteId=hiliteId;
  statement.params.spanClass=hiliteObject.hiliteSpans[k].spanClass;
  statement.params.tc=hiliteObject.hiliteSpans[k].textContent;
  statement.params.startOffset=hiliteObject.hiliteSpans[k].startOffset;
  statement.params.endOffset=hiliteObject.hiliteSpans[k].endOffset;
  statement.executeStep();
  //console.log("Posted hilite span:\n"+hiliteObject.hiliteSpans[k].textContent);
  //postToDict(dbConn,hiliteId,hiliteObject.hiliteSpans[k]);
 }
 nextSpanId(dbConn);
}

// hiliteRestorer differs from hiLite/hiliteSpan
// in that the style property is tagged to each
// span; not the highlight as a whole.
// This allows a simpler SQLite query
// in serializeHilites(), farther down this file.
function hiliteRestorer(id,spanClass,text,start,end,style) { // constructor for restorer objects
// spanClass: 0, 1, 2 or 3
// 0th order bit set if end of span is before end of node, clear if not
// 1st order bit set if start of span is after start of node, clear if not
 this.hiliteId=id;
 this.spanClass=spanClass;
 this.textContent=text;
 this.startOffset=start;
 this.endOffset=end;
 this.style=style;
}


// serializeHilites assembles the payload for the onAttach worker farther down
//Payload will be an array of hiliteRestorer objects,
function serializeHilite(dbConn,url) {
 var hlSpans=[];
 var urlId=getUrlKey(dbConn,url);
 var query="SELECT hilitespan.hilitespanid, hilitespan.spanclass,"+
 " hilitespan.textcontent,"+
 " hilitespan.startoffset, hilitespan.endoffset, hilite.style"+
 " FROM hilite,hilitespan"+
 " WHERE hilitespan.hiliteid=hilite.hiliteid"+
 " AND hilite.urlid=:urlId";
 var statement=dbConn.createStatement(query);
 statement.params.urlId=urlId;
 while (statement.executeStep()) {
  hlSpans.push(new hiliteRestorer(statement.getString(0),statement.getString(1),
   statement.getString(2),statement.getString(3),statement.getString(4),statement.getString(5)));
 }
 return (JSON.stringify(hlSpans));
}

function postUndo(dbConn) {
 // make DB reflect most recent undo
 var statement=dbConn.createStatement("SELECT max(hiliteid) FROM hilite");
 statement.executeStep();
 var latestHilite=statement.getString(0);
 statement=dbConn.createStatement("SELECT hilitespanid FROM hilitespan WHERE hiliteid=:latestHilite");
 statement.params.latestHilite=latestHilite;
 var value=[];
 while (statement.executeStep()) {
  value.push(statement.getString(0));
 }
 var deleteQuery="DELETE FROM hilite WHERE hiliteid=:latestHilite";
 statement=dbConn.createStatement(deleteQuery);
 statement.params.latestHilite=latestHilite;
 statement.executeStep();
 statement=dbConn.createStatement("DELETE FROM hilitespan WHERE hiliteid=:latestHilite");
 statement.params.latestHilite=latestHilite;
 statement.executeStep();
 return (value);
}


function eraseQuery(dbConn,url) {
 var value=[];
 var getHiliteIds=dbConn.createStatement(
  "select b.hiliteid"+
  " from url a, hilite b"+
  " where a.urlid=b.urlid"+
  " and a.url=:url"
 );
 getHiliteIds.params.url=url;
 while (getHiliteIds.executeStep()) {
  hiliteId=getHiliteIds.getString(0);
  //console.log("About to delete hiliteId #"+hiliteId);

  statement=dbConn.createStatement("select hilitespanid from hilitespan where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  while (statement.executeStep()) {
   hiliteSpanId=statement.getString(0);
   //console.log("About to delete hiliteSpanId #"+hiliteSpanId);
   value.push(hiliteSpanId);
  }

  statement=dbConn.createStatement("delete from hilitespan where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  statement.executeStep();

  statement=dbConn.createStatement("delete from wordinhilite where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  statement.executeStep();

  statement=dbConn.createStatement("delete from hilite where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  statement.executeStep();
 }
 return (value);
}

function nextSpanId(dbConn) { // set up id for next hilite span
 var statement=
  dbConn.createStatement("SELECT MAX (hilitespanid) FROM hilitespan");
 statement.executeStep();
 ss.storage.serialno=statement.getString(0);
 //console.log("Next SpanId:"+ss.storage.serialno);
 item.data=JSON.stringify(ss.storage);
}

// Dun w. function definitions

//exports.main=function(options,callbacks) {


// dbInit() Should only execute
// only the first time this add-on runs following installation
// see
// https://minghuasweblog.wordpress.com/2011/08/21/firefox-extension-javascript-access-local-file/
 var dbConn;

 let file = FileUtils.getFile("ProfD", ["patma.sqlite"]);
// if (!file.exists())
  dbConn=dbInit(file);
// else
//  dbConn = Services.storage.openDatabase(file);




 
// fetch url
 pageMod.PageMod({ 
   include: ["*"],
   contentScriptWhen: "end",
   contentScriptFile: [data.url("shared.js")],
   onAttach:function (worker) {
      url=tabs.activeTab.url;
      if (beenHereBefore(dbConn,url)) {
       // restore previous highlights for this page
       // listener for reHilite is in shared.js
       worker.port.emit("reHilite",serializeHilite(dbConn,url));
      }
      nextSpanId(dbConn);
      item.data=JSON.stringify(ss.storage);
   }
 });

 worker=tabs.activeTab.attach({contentScriptFile:[data.url("shared.js")]});


// context menu for highlighting text
 var item=cm.Item({ //create menu item for highlighter
   label:"Highlight selected text",
   context:cm.SelectionContext(),
   contentScriptWhen:"start",
   data:JSON.stringify(ss.storage),
   contentScriptFile:[data.url("shared.js"),data.url("menu.js")],
   // when content script finishes highlighting
   // record details in DB:
   onMessage:function (selectionJson) {
    ss.storage.serialno=JSON.parse(selectionJson).serialno;
    //item.data=JSON.stringify(ss.storage);
    postToSqlite(dbConn,selectionJson);
   }
 });

 
// widget for selecting highlighter color:
 var selectColor=widget.Widget({
   id: "cealed",
   label: "Select highlighter color",
   //contentURL: data.url("hiliter.ico"),
   content:selectColorContentLeft+ss.storage.style+selectColorContentRight,
   onClick: function() {
    // toggle visibility of panel by clicking widget:
    colorPanel.isShowing ? colorPanel.hide() : colorPanel.show();
   }
 });
 
 //console.log(selectColor.content);
 

// panel for selecting highlighter color
 var colorPanel = require("panel").Panel({
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
   selectColor.content=
    selectColorContentLeft+ss.storage.style+selectColorContentRight;
   item.data=JSON.stringify(ss.storage);
   worker=tabs.activeTab.attach({
     contentScriptFile:[data.url("shared.js"),data.url("now.js")],
   onMessage:function (selectionJson) {
//     ss.storage.serialno=JSON.parse(selectionJson).serialno;
     item.data=JSON.stringify(ss.storage);
     postToSqlite(dbConn,selectionJson);
    }
   });
   worker.port.emit("hiliteNow",JSON.stringify(ss.storage));
 });


 var undo=widget.Widget({
   id:"cating",
   label:"undo most recent highlight",
   content:
    "<div style=\"height: 100%; text-align: center; vertical-align:middle;\">&#8634;</div>", // 8634
   onClick:function () {
    var spanIds=postUndo(dbConn);
    worker=tabs.activeTab.attach({
      contentScriptWhen:"start",
      contentScriptFile:[data.url("shared.js")]
      //onMessage:function (stackString) {
      // console.log("message from \"undoHilite\":"+stackString);
      // ss.storage.serialStack=JSON.parse(stackString);
      // postUndo(dbConn); // reflect undo in DB
      //}
    });
    //console.log("about to emit \"undoHilite\":\n"+JSON.stringify(spanIds));
    worker.port.emit("undoHilite",JSON.stringify(spanIds));
   },
 });

 var erase=widget.Widget({
   id:"magated",
   label:"erase all highlights in current tab",
   content:
    "<div style=\"height: 100%; text-align: center; vertical-align:middle;\">&#9649;</div>", // 9649
   contentScriptWhen:"start",
   contentScriptUrl:data.url("shared.js"),
   onClick:function () {
    eraseWorker=tabs.activeTab.attach({
      contentScriptWhen:"start",
      contentScriptFile:[data.url("shared.js")],
    });
    idList=eraseQuery(dbConn,tabs.activeTab.url);
    eraseWorker.port.emit("eraseHilites",JSON.stringify(idList));
   },
 });

 // set ss.storage.serialno to next hilitespanid to be assigned
 nextSpanId(dbConn);

//}
