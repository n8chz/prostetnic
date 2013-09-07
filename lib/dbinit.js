// sql.js - Prostetnic Highlighter w. lookup's module
// author: n8chz

// see https://developer.mozilla.org/en/Storage
// see also http://stackoverflow.com/a/12589707/1269964

var {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");  
Cu.import("resource://gre/modules/FileUtils.jsm");



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






var createInstancesView=
"create view if not exists instances as"+
" select datetime(b.ts,\"unixepoch\",\"localtime\") ts, a.url url, b.style style, c.textcontent text"+
" from url a, hilite b, hilitespan c"+
" where a.urlid=b.urlid"+
" and b.hiliteid=c.hiliteid";

function dbInit(file) {
 let dbConn = Services.storage.openDatabase(file); // Will also create the file if it does not exist  
 dbConn.executeSimpleSQL(createUrlTable);
 dbConn.executeSimpleSQL(createUrlIndex);
 dbConn.executeSimpleSQL(createHiliteTable);
 dbConn.executeSimpleSQL(createTimestampIndex);
 dbConn.executeSimpleSQL(createHiliteSpanTable);
 dbConn.executeSimpleSQL(createInstancesView);
 return (dbConn);
}

exports.dbInit = dbInit;