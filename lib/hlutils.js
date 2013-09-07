// hlutils.js - Prostetnic Highlighter w. lookup's module
// author: n8chz

main=require("main");

// If attached page's url appears in db
// then we have highlights to restore
function beenHereBefore(dbConn,url) {
 //// // console.log(url);
 var statement=dbConn.createStatement("SELECT urlid FROM url WHERE url=:url");
 statement.params.url=url;
 if (statement.executeStep()) {
  var urlId=statement.getString(0);
  //// // console.log(urlId);
  return (urlId);
 }
 else {
  return false;
 }
}

exports.beenHereBefore=beenHereBefore;

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

exports.getUrlKey=getUrlKey;



// Make a record of the highlight just rendered
// by hilite() in "shared.js".
// The parameters of this highlight
// are in selectionJson, which have been
// stringified for us by conext-menu cm's
// click listener.
function postToSqlite (dbConn, hiliteObject) {
<<<<<<< HEAD
 // console.log("hiliteObject: "+JSON.stringify(hiliteObject));
=======
 // // console.log(JSON.stringify(hiliteObject));
>>>>>>> prostetnic/master
 main.ss.storage.serialStack.push(hiliteObject.serialno);
 var urlKey=getUrlKey(dbConn,hiliteObject.url);
 var statement=
  dbConn.createStatement(
   "INSERT INTO hilite(urlid,ts,style) VALUES (:urlKey, :timeStamp, :style)");
 statement.params.urlKey=urlKey;
 statement.params.timeStamp=hiliteObject.timeStamp;
 statement.params.style=main.ss.storage.style;
 statement.executeStep();
 statement=dbConn.createStatement("SELECT MAX(hiliteid) FROM hilite");
 statement.executeStep();
 var hiliteId=statement.getString(0);
 for (var k=0; k<hiliteObject.hiliteSpans.length; k++) {
  if (hiliteObject.hiliteSpans[k]) { // This is a kludge.
   // hiliteObject.hiliteSpans[k].textContent=hiliteObject.hiliteSpans[k].textContent.replace(/'/g,"''");
   // prev. line should be unnecessary w. bound parameters
   // // console.log(JSON.stringify(hiliteObject.hiliteSpans[k]));
   insertSpan="INSERT INTO"+
    " hilitespan(hilitespanid,hiliteid,spanclass,textcontent,startoffset,endoffset)"+
    " VALUES (:hiliteSpanId, :hiliteId, :spanClass, :tc, :startOffset, :endOffset)";
   statement=dbConn.createStatement(insertSpan);
   statement.params.hiliteSpanId=hiliteObject.hiliteSpans[k].hiliteSpanId;
   statement.params.hiliteId=hiliteId;
   statement.params.spanClass=hiliteObject.hiliteSpans[k].spanClass;
   statement.params.tc=hiliteObject.hiliteSpans[k].textContent;
   statement.params.startOffset=hiliteObject.hiliteSpans[k].startOffset;
   statement.params.endOffset=hiliteObject.hiliteSpans[k].endOffset;
   statement.executeStep();
   //// // console.log("Posted hilite span:\n"+hiliteObject.hiliteSpans[k].textContent);
   //postToDict(dbConn,hiliteId,hiliteObject.hiliteSpans[k]);
  }
 }
 nextSpanId(dbConn);
}

exports.postToSqlite=postToSqlite;

// hiliteRestorer differs from hiLite/hiliteSpan
// in that the style property is tagged to each
// span; not the highlight as a whole.
// This allows a simpler SQLite query
// in serializeHilites(), farther down this file.
function hiliteRestorer(id,spanClass,text,start,end,style,hlid) {
// constructor for restorer objects
// spanClass: 0, 1, 2 or 3
// 0th order bit set if end of span is before end of node, clear if not
// 1st order bit set if start of span is after start of node, clear if not
 this.hiliteSpanId=id;
 this.spanClass=spanClass;
 this.textContent=text;
 this.startOffset=start;
 this.endOffset=end;
 this.style=style;
 this.hiliteId=hlid;
}

exports.hiliteRestorer=hiliteRestorer;

// return array of hiLite objects representing hilites in url
function serializeHilite(dbConn, url) {
 var newHilite, hiliteId, innerStatement, hiliteSpanId, textContent;
 var result = [];
 var urlId = getUrlKey(dbConn, url);
 var query = "select hiliteid, style from hilite where urlid=:urlid";
 var statement = dbConn.createStatement(query);
 statement.params.urlid = urlId;
 while (statement.executeStep()) { // collect hilite objects in outer loop
  hiliteId = statement.getString(0);
  newHilite = {
   url: url,
   style: statement.getString(1),
   textContent: "",
   hiliteSpans: []
  };
  // // console.log(JSON.stringify(newHilite));
  query = "select hilitespanid, textcontent from hilitespan where hiliteid=:hiliteid";
  innerStatement = dbConn.createStatement(query);
  innerStatement.params.hiliteid = hiliteId;
  // console.log("hiliteId: "+hiliteId);
  while (innerStatement.executeStep()) { // collect span objects 4 each hilite
   // console.log("iteration of inner statement loop");
   hiliteSpanId = innerStatement.getString(0); // This line is a sticking point
   // console.log("hiliteSpanId: "+hiliteSpanId);
   // // console.log("(in serializeHilite) "+hiliteId+" "+hiliteSpanId);
   textContent = innerStatement.getString(1);
   newHilite.textContent += textContent;
   newHilite.hiliteSpans.push({
     hiliteSpanId: hiliteSpanId,
     textContent: textContent
   });
  }
  result.push(newHilite);
 }
 return result;
}

exports.serializeHilite=serializeHilite;

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

exports.postUndo=postUndo;

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
  //// // console.log("About to delete hiliteId #"+hiliteId);

  statement=dbConn.createStatement("select hilitespanid from hilitespan where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  while (statement.executeStep()) {
   hiliteSpanId=statement.getString(0);
   //// // console.log("About to delete hiliteSpanId #"+hiliteSpanId);
   value.push(hiliteSpanId);
  }

  statement=dbConn.createStatement("delete from hilitespan where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  statement.executeStep();

  statement=dbConn.createStatement("delete from hilite where hiliteid=:hiliteid");
  statement.params.hiliteid=hiliteId;
  statement.executeStep();
 }
 return (value);
}

exports.eraseQuery=eraseQuery;

function nextSpanId(dbConn) { // set up id for next hilite span
 var statement=
  dbConn.createStatement("SELECT MAX (hilitespanid) FROM hilitespan");
 statement.executeStep();
 main.ss.storage.serialno=+statement.getString(0)+1; // one higher than last time
 //// // console.log("Next SpanId:"+ss.storage.serialno);
 main.item.data=JSON.stringify(main.ss.storage);
}

exports.nextSpanId=nextSpanId;

function matchingPages(wordsJson) {
 var wordArray=JSON.parse(wordsJson);
 var queryString="select * from instances where";
 queryString += (new Array(wordArray.length+1)).join(" text like \"%\"||?||\"%\" ").split("  ").join(" and ");
 // h/t http://blog.magnetiq.com/post/497607385/repeating-or-padding-strings-in-javascript
 queryString += "limit 50";
 //// // console.log(queryString);
 // see http://www.wxjavascript.net/sqlite/classes/stmt.html
 var statement=main.dbConn.createStatement(queryString);
 for (k=0; k<wordArray.length; k++) {
  statement.params[k] = wordArray[k];
 }
 var queryResult=[];
 while (statement.executeStep()) {
  newRow=[];
  queryResult.push(newRow);
  for (k=0; k<4; k++) {
   newRow.push(statement.getString(k));
  } 
 }
 // There's got to be a better way to do the above
 //// // console.log(JSON.stringify(queryResult));
 return (queryResult); 
}

exports.matchingPages=matchingPages;

// Dun w. function definitions