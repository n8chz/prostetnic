var ProstetnicHighlighter = (function () {

/*
 * @param options object with properties image, desc, event, payload, callback
 * @param api object with properties actionButton, tabs, contextMenu, hotkey
 */
  function Command(api, options) {
   this.api = api;
   this.options = options;
   this.button = this.makeButton();
   this.menuItem = this.makeMenuItem();
   this.hotkey = this.makeHotkey();
  }

  Command.prototype = {

/*
 *
 */
   makeButton: function () {
    var id = this.options.image.substring(0,4) == "data" ? "hilite" : this.options.image.split("/").pop().split(".")[0];
    return this.api.actionButton({
      id: id, // kludge
      label: this.options.desc,
      icon: this.options.image,
      onClick: this.makeMethod()
    });
   },

/*
 *
 */
   makeMenuItem: function () {
    return this.api.contextMenu.Item({
      label: this.options.desc,
      image: this.options.image,
      data: JSON.stringify(this.options.payload),
      context: this.api.contextMenu.URLContext("*"),
      contentScriptFile: this.options.contentScriptFile,
      onMessage: this.options.callback
    });
   },

/*
 *
 */
   makeHotkey: function () {
    return this.api.hotkey({
      combo: this.options.desc.split(/[()]/)[1].replace("Ctrl", "accel").toLowerCase(), // kludge
      onPress: this.makeMethod()
    });
   },

/*
 *
 */
   makeMethod: function () {
    var api = this.api;
    var options = this.options;
    return function () {
     var worker = api.tabs.activeTab.attach({
       contentScriptFile: options.contentScriptFile,
       onMessage: options.callback
     });
     worker.port.on("done", options.callback);
     worker.port.emit(options.event, JSON.stringify(options.payload));
    };
   }

  };

/*
 *
 */
  function HighlighterSystem() {

   var system=this; // kludge to sort out 'this' references in methods

   // Set up buttons, hotkeys and menus for the five system commands:
   var { ActionButton } = require("sdk/ui/button/action");
   var { Hotkey } = require("sdk/hotkeys");
   this.api = {
    data: require("sdk/self").data,
    actionButton: ActionButton,
    tabs: require("sdk/tabs"),
    contextMenu: require("sdk/context-menu"),
    hotkey: Hotkey
   };

   this.setupDB();

   this.colorPanel = require("sdk/panel").Panel({
     height: 768,
     width: 456,
/*
     contentURL: this.api.data.url("colors.html"),
     contentScriptFile: this.api.data.url("panel.js")
*/
     contentURL: this.api.data.url("picker.html"),
     contentScriptFile: this.api.data.url("picker.js")
   });

   this.colorPanel.port.on("newStyle", function (style) {
     console.log("newStyle: "+style);
     system.colorPanel.hide();
     system.storage.style = style;
     system.highlight.menuItem.data = system.storage;
     system.highlight.button.click(); // Hilight selection (if any) in new style
     console.log("newStyle processed. system.storage: "+JSON.stringify(system.storage));
     system.svgWorker.port.emit("updateIcon", style);
   });

   this.storage = require("sdk/simple-storage").storage;
   if (!this.storage.style) this.storage.style = "color:black;background:yellow;"
   this.storage.serialStack = undefined;
   this.storage.hiliteSpanID = this.nextHiliteSpanID();

   this.color = new Command(this.api, {
     image: this.api.data.url("palette.svg"),
     desc: "Select highlighter color (Ctrl-Alt-A)",
     contentScriptFile: this.api.data.url("color.js"),
     event: "color",
     payload: undefined,
     callback: function () {
      console.log("color selection callback");
      system.colorPanel.isShowing ? system.colorPanel.hide() : system.colorPanel.show();
      if (system.colorPanel.isShowing) {
       system.colorPanel.hide();
      }
      else {
       system.colorPanel.show();
       system.colorPanel.port.emit("logStyle", system.storage.style);
      }
     }
   });
   this.highlight = new Command(this.api, {
     image: this.storage.highlightIcon ? this.storage.highlightIcon : this.api.data.url("hilite.svg"),
     desc: "Highlight current selection (Ctrl-Alt-H)",
     contentScriptFile: this.api.data.url("hilite.js"),
     event: "hilite",
     payload: this.storage,
     callback: function (hiliteJSON) {
      var hilite = JSON.parse(hiliteJSON);
      var hiliteID = system.postHighlight(hilite);
      for each (var hiliteSpan in hilite.hiliteSpans) {
       system.postHighlightSpan(hiliteID, hiliteSpan);
      }
      console.log("About to update this.storage.hiliteSpanID");
      system.storage.hiliteSpanID = system.nextHiliteSpanID();
      system.highlight.menuItem.data = JSON.stringify(system.storage);
      console.log("system.highlight.menuItem.data: "+system.highlight.menuItem.data);
     }
   });
   // TODO create svgWorker for this.highlight, and event listener for same.
   this.svgWorker = require("sdk/page-worker").Page({
     contentURL: this.highlight.button.icon,
     contentScriptFile: this.api.data.url("change.js")
   });
   this.svgWorker.port.on("newIcon", function (b64code) {
     system.storage.highlightIcon = system.highlight.button.icon = system.highlight.menuItem.image = "data:image/svg+xml;base64,"+b64code;
     console.log(system.highlight.button.icon);
   });
   this.undo = new Command(this.api, {
     image: this.api.data.url("undo.svg"),
     desc: "Undo most recent highlight on this page (Ctrl-Alt-Z)",
     contentScriptFile: this.api.data.url("undo-or-erase.js"),
     event: "undo",
     payload: null,
     callback: function () {
      system.api.tabs.activeTab.attach({
        contentScriptFile: system.api.data.url("undo-or-erase.js")
      }).port.emit("removeSpans", JSON.stringify(system.spansToUndo()));
     }
   });
   this.erase = new Command(this.api, {
     image: this.api.data.url("erase.svg"),
     desc: "Erase all highlights on this page (Ctrl-Alt-N)",
     contentScriptFile: this.api.data.url("undo-or-erase.js"),
     event: "erase",
     payload: null,
     callback: function () {
      system.api.tabs.activeTab.attach({
        contentScriptFile: system.api.data.url("undo-or-erase.js")
      }).port.emit("removeSpans", JSON.stringify(system.spansToErase()));
     }
   });
   this.find = new Command(this.api, {
     image: this.api.data.url("search.svg"),
     desc: "Search for words in previously highlighted pages (Ctrl-Alt-F)",
     contentScriptFile: this.api.data.url("find.js"),
     event: "find",
     payload: null,
     callback: function () {
      system.api.tabs.open({
        url: system.api.data.url("search.html"),
        onReady: function (tab) {
         var worker = tab.attach({
           contentScriptFile: system.api.data.url("find.js")
         });
         var pageSearcher;
         worker.port.on("searchTextChange", function (wordsJSON) {
           // console.log("\"searchTextChange\" event received");
           pageSearcher = new PageSearcher(system.dbConn, worker, JSON.parse(wordsJSON));
           // console.log("created new PageSearcher instance");
           pageSearcher.getRow();
         });
         worker.port.on("nextRow", function () {
           pageSearcher.getRow();
         });
        }
      });
     }
   });

   var tabs = require("sdk/tabs");

   var updateURL = function (tab) {
     var oldURL = system.url;
     system.url = tab.url.split("#")[0]; // kludge?
     
     console.log(oldURL+" --> "+system.url);
   };

   tabs.on("activate", updateURL);
   tabs.on("pageshow", updateURL);

   updateURL(tabs.activeTab);

   require("sdk/page-mod").PageMod({
     include: "*",
     contentScriptFile: this.api.data.url("hilite.js"),
     onAttach: function (worker) { // Can attach method be forced? If so, that might be key to 'undo'...
      var url = tabs.activeTab.url;
      var hilites = system.previousHighlights(url);
      if (hilites.length) {
       worker.port.emit("reHilite", JSON.stringify(hilites));
      }
     }
   });

  }

  HighlighterSystem.prototype = {

/*
 *
 */
   getHiliteID: function () {
    var statement = this.dbConn.createStatement("select max(hilitespanid) from hilitespan");
    statement.executeStep();
    return statement.getString(0)-0+1; // Oy Javascript
   },

/*
 *
 */
   setupDB: function () {
    var {
     Cc, Ci, Cu
    } = require("chrome");
    Cu.import("resource://gre/modules/Services.jsm");
    Cu.import("resource://gre/modules/FileUtils.jsm");
    let file = FileUtils.getFile("ProfD", ["patma.sqlite"]);
    this.dbConn = Services.storage.openDatabase(file);
    this.generateDB();
   },

/*
 *
 */
   generateDB: function () {
    var schema = [
     "CREATE TABLE IF NOT EXISTS hilite( hiliteid INTEGER PRIMARY KEY,"
      +" urlid INTEGER, ts INTEGER, style VARCHAR, FOREIGN KEY(urlid)"
      +" REFERENCES url(urlid))",
     "CREATE TABLE IF NOT EXISTS hilitespan( hilitespanid INTEGER PRIMARY KEY,"
      +" hiliteid INTEGER, textcontent VARCHAR,"
      +" startoffset INTEGER, endoffset INTEGER, FOREIGN KEY(hiliteid)"
      +" REFERENCES hilite(hiliteid))",
     "CREATE TABLE IF NOT EXISTS url( urlid INTEGER PRIMARY KEY, url VARCHAR)",
     "CREATE VIEW IF NOT EXISTS instances as"
      +" select datetime(b.ts,\"unixepoch\",\"localtime\") ts, a.url url,"
      +" b.style style, c.textcontent text from url a, hilite b, hilitespan c"
      +" where a.urlid=b.urlid and b.hiliteid=c.hiliteid",
     "CREATE INDEX IF NOT EXISTS tsi ON hilite(ts)",
     "CREATE UNIQUE INDEX IF NOT EXISTS urli ON url(url)"
    ];
    for each (var create in schema) {
     this.dbConn.executeSimpleSQL(create);
    }
   },

/*
 *
 */
   nextHiliteSpanID: function () {
    var statement = this.dbConn.createStatement("select max(hilitespanid) from hilitespan");
    statement.executeStep();
    return statement.getString(0)-0+1;
   },

   getURLid: function(url) {
    var statement = this.dbConn.createStatement("select urlid from url where url = :url");
    statement.params.url = url;
    if (statement.executeStep())
     return statement.getString(0);
    else {
     statement = this.dbConn.createStatement("insert into url(url) values (:url)");
     statement.params.url = url;
     statement.executeStep();
     return this.getURLid(url);
    }
   },

/*
 *
 */
   postHighlight: function(hilite) {
    console.log("About to post hilite: "+JSON.stringify(hilite));
    var urlID = this.getURLid(hilite.url.split("#")[0]);
    var statement = this.dbConn.createStatement("insert into hilite(urlid, ts, style) values (:urlID, :timeStamp, :style)");
    statement.params.urlID = urlID;
    statement.params.timeStamp = hilite.timeStamp;
    statement.params.style = hilite.style;
    statement.executeStep();
    statement = this.dbConn.createStatement("select max(hiliteid) from hilite");
    statement.executeStep();
    return statement.getString(0);
   },

/*
 *
 */
   postHighlightSpan: function (hiliteID, hiliteSpan) {
    console.log("About to post hilite span: "+JSON.stringify(hiliteSpan));
    var statement = this.dbConn.createStatement("insert into hilitespan(hiliteSpanID, hiliteid, textcontent, startoffset, endoffset) values (:hiliteSpanID, :hiliteID, :textContent, :startOffset, :endOffset)");
    statement.params.hiliteSpanID = hiliteSpan.hiliteSpanID;
    statement.params.hiliteID = hiliteID;
    statement.params.textContent = hiliteSpan.textContent;
    statement.params.startOffset = hiliteSpan.startOffset;
    statement.params.endOffset = hiliteSpan.endOffset;
    statement.executeStep();
   },

/*
 *
 */
   spansForHighlight: function (hiliteID) {
    var value = [];
    var statement = this.dbConn.createStatement("select hilitespanid, textcontent, startoffset, endoffset from hilitespan where hiliteid = :hiliteID");
    statement.params.hiliteID = hiliteID;
    while (statement.executeStep()) {
     value.push({
       hiliteSpanID: statement.getString(0),
       textContent: statement.getString(1),
       startOffset: statement.getString(2),
       endOffset: statement.getString(3)
     });
    }
    return value;
   },

/*
 *
 */
   previousHighlights: function (url) {
    var value = [], hiliteID;
    var statement = this.dbConn.createStatement("select b.hiliteid, b.style from url a, hilite b where a.urlid = b.urlid and a.url = :url");
    statement.params.url = url;
    while (statement.executeStep()) {
     hiliteID = statement.getString(0);
     value.push({
       hiliteID: hiliteID,
       style: statement.getString(1),
       hiliteSpans: this.spansForHighlight(hiliteID)
     });
    }
    return value;
   },

/*
 *
 */
   spansToUndo: function () {
    var value = [];
    var statement = this.dbConn.createStatement("select max(a.hiliteid) from hilite a, url b where a.urlid=b.urlid and b.url=:url");
    statement.params.url = this.url;
    if (statement.executeStep()) {
     var hiliteID = statement.getString(0);
     statement = this.dbConn.createStatement("select hilitespanid from hilitespan where hiliteid = :hiliteid");
     statement.params.hiliteid = hiliteID;
     while (statement.executeStep()) {
      value.push(statement.getString(0));
     }
     statement = this.dbConn.createStatement("delete from hilitespan where hiliteid = :hiliteID");
     statement.params.hiliteID = hiliteID;
     statement.executeStep();
     statement = this.dbConn.createStatement("delete from hilite where hiliteid = :hiliteID");
     statement.params.hiliteID = hiliteID;
     statement.executeStep();
    }
    return value;
   },

/*
 *
 */
   spansToErase: function () {
    var innerStatement, hiliteID;
    var value = [];
    var urlID = this.getURLid(this.url);
    var statement = this.dbConn.createStatement("select hiliteid from hilite where urlid=:urlid");
    statement.params.urlid = urlID;
    while (statement.executeStep()) {
     hiliteID = statement.getString(0);
     innerStatement = this.dbConn.createStatement("select hilitespanid from hilitespan where hiliteid=:hiliteID");
     innerStatement.params.hiliteID = hiliteID;
     while (innerStatement.executeStep()) {
      value.push(innerStatement.getString(0));
     }
     innerStatement = this.dbConn.createStatement("delete from hilitespan where hiliteid=:hiliteid");
     innerStatement.params.hiliteid = hiliteID;
     innerStatement.executeStep();
    }
    statement = this.dbConn.createStatement("delete from hilite where urlid=:urlid");
    statement.params.urlid=urlID;
    statement.executeStep();
    return value;
   }

  };

/*
 * Create a statement for a search query, from which one row at a time can be
 * fetched asynchronously.
 */
  function PageSearcher(dbConn, worker, words) {
   this.worker = worker;
   var queryString = "select * from instances where";
   queryString += words.map(function (word) {
     return " text like \"%"+word+"%\"";
   }).join(" and ");
   this.statement = dbConn.createStatement(queryString);
   this.urlList = [];
  }

  PageSearcher.prototype = {

/*
 *
 */
   getRow: function () {
    // console.log("entered getRow() method");
    if (this.statement.executeStep()) {
     // console.log("successfully executed step on statement");
     url = this.statement.getString(1);
     // console.log("got url: "+url);
     if (this.urlList.indexOf(url) != -1) {
      this.getRow();
     }
     else {
      this.urlList.push(url);
      this.worker.port.emit("newRow", JSON.stringify({
         date: this.statement.getString(0),
         url: url,
         style: this.statement.getString(2),
         text: this.statement.getString(3)
      }));
     }
    }
   }

  };

  return new HighlighterSystem();

})();

