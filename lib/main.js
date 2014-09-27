var ProstetnicHighlighter = (function () {

/*
 * @constructor
 * @param options object with properties image, desc, event, payload, callback
 * @param api object with properties actionButton, tabs, contextMenu, hotkey
 */
  function Command(api, options) {
   this.api = api;
   this.options = options;
   if (typeof api.actionButton !== "undefined") {
    this.button = this.makeButton();
    this.widget = {};
   }
   else {
    this.widget = this.makeWidget();
    this.button = {};
   }
   this.menuItem = this.makeMenuItem();
   this.hotkey = this.makeHotkey();
  }

  Command.prototype = {


   makeWidget: function () {
    var id = this.options.image.substring(0,4) == 
     "data" ? "hilite" : this.options.image.split("/").pop().split(".")[0];
    return this.api.widget({
      id: id, // kludge
      label: this.options.desc,
      contentURL: this.options.image,
      onClick: this.makeMethod()
    });
   },

/*
 * @return ActionButton with parameters in this.options
 */
   makeButton: function () {
    var id = this.options.image.substring(0,4) == 
     "data" ? "hilite" : this.options.image.split("/").pop().split(".")[0];
    return this.api.actionButton({
      id: id, // kludge
      label: this.options.desc,
      icon: this.options.image,
      onClick: this.makeMethod()
    });
   },

/*
 * @return menu item with parameters in this.options
 */
   makeMenuItem: function () {
    return this.api.contextMenu.Item({
      label: this.options.desc,
      image: this.options.image,
      data: JSON.stringify(this.options.payload),
      context: this.api.contextMenu.URLContext("*"),
      contentScriptFile: this.options.contentScriptFile,
      contentStyleFile: this.options.contentStyleFile,
      onMessage: this.options.callback
    });
   },

/*
 * @return hot key represented in String this.options.desc
 */
   makeHotkey: function () {
    return this.api.hotkey({
      combo:
       this.options.desc
        .split(/[()]/)[1].replace("Ctrl", "accel").toLowerCase(), // kludge
      onPress: this.makeMethod()
    });
   },

/*
 * @return Function that creates a page-worker to trigger function referenced
 *  by options.callback
 */
   makeMethod: function () {
    var api = this.api;
    var options = this.options;
    return function () {
     var worker = api.tabs.activeTab.attach({
       contentScriptFile: options.contentScriptFile,
       contentStyleFile: options.contentStyleFile,
       onMessage: options.callback
     });
     worker.port.on("done", options.callback);
     worker.port.emit(options.event, JSON.stringify(options.payload));
    };
   }

  };

/*
 * Container for all objects required to work add-on script
 * @constructor
 */
  function HighlighterSystem() {

   var system=this; // kludge to sort out 'this' references in methods

   // Set up buttons, hotkeys and menus for the five system commands:
   var { Hotkey } = require("sdk/hotkeys");
   // Add-on SDK API's required by add-on:
   this.api = {
    data: require("sdk/self").data,
    tabs: require("sdk/tabs"),
    contextMenu: require("sdk/context-menu"),
    hotkey: Hotkey,
    widget: widget
   };
   try {
    var { ActionButton } = require("sdk/ui/button/action");
    this.api.actionButton = ActionButton;
   }
   catch (e) {
    var widget = require("sdk/widget");
    this.api.widget = widget.Widget;
   }

   this.setupDB();

   // panel to present color picker for background and text colors
   this.colorPanel = require("sdk/panel").Panel({
     height: 768,
     width: 456,
     contentURL: this.api.data.url("picker.html"),
     contentScriptFile: this.api.data.url("picker.js")
   });

   // Make note of newly selected highlighter colors
   this.colorPanel.port.on("newStyle", function (style) {
     system.colorPanel.hide();
     system.storage.style = style;
     system.highlight.menuItem.data = system.storage;
     try {
      system.highlight.button.click(); // Hilight selection (if any) in new style
     }
     catch (e) {
      var worker = system.api.tabs.activeTab.attach({
        contentScriptFile: system.api.data.url("hilite.js")
      });
      worker.port.emit("hilite", JSON.stringify(system.storage));
      worker.destroy();
     }
     // Change icon for hilite command in ActionButton and menu item
     system.svgWorker.port.emit("updateIcon", style);
   });

   // simple storage stores color selections,
   // and most recently generated hiliteSpanID
   this.storage = require("sdk/simple-storage").storage;
   if (!this.storage.style) this.storage.style = "color:black;background:yellow;"
   // serialStack no longer used, clean up after older versions:
   this.storage.serialStack = undefined;
   this.storage.hiliteSpanID = this.nextHiliteSpanID();

   // create interfaces for color selection
   this.color = new Command(this.api, {
     image: this.api.data.url("palette.svg"),
     desc: "Select highlighter color (Ctrl-Alt-A)",
     contentScriptFile: this.api.data.url("color.js"),
     event: "color",
     payload: undefined,
     callback: function () {
      if (system.colorPanel.isShowing) {
       system.colorPanel.hide();
      }
      else {
       system.colorPanel.show();
       system.colorPanel.port.emit("logStyle", system.storage.style);
      }
     }
   });
   // create interfaces for highlight command
   this.highlight = new Command(this.api, {
     image:
      this.storage.highlightIcon ? this.storage.highlightIcon : this.api.data.url("hilite.svg"),
     desc: "Highlight current selection (Ctrl-Alt-H)",
     contentScriptFile: this.api.data.url("hilite.js"),
     contentStyleFile: this.api.data.url("prostetnic.css"),
     event: "hilite",
     payload: this.storage,
     callback: function (hiliteJSON) {
      var hilite = JSON.parse(hiliteJSON);
      var hiliteID = system.postHighlight(hilite);
      for each (var hiliteSpan in hilite.hiliteSpans) {
       system.postHighlightSpan(hiliteID, hiliteSpan);
      }
      system.storage.hiliteSpanID = system.nextHiliteSpanID();
      system.highlight.menuItem.data = JSON.stringify(system.storage);
     }
   });
   // page-worker for content script to alter SVG code representing highlight
   // button icon
   this.svgWorker = require("sdk/page-worker").Page({
     contentURL: this.highlight.button.icon || this.highlight.widget.contentURL,
     contentScriptFile: this.api.data.url("change.js")
   });
   // store base64 of new SVG file in the appropriate places
   this.svgWorker.port.on("newIcon", function (b64code) {
     system.storage.highlightIcon =
     system.highlight.button.icon = 
     system.highlight.widget.contentURL =
     system.highlight.menuItem.image = "data:image/svg+xml;base64,"+b64code;
   });
   // create interfaces for undo command
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
   // create interfaces for "erase all this page"
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
   // create interfaces for text search feature:
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
           pageSearcher =
            new PageSearcher(system.dbConn, worker, JSON.parse(wordsJSON));
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
     
   };

   tabs.on("activate", updateURL);
   tabs.on("pageshow", updateURL);

   updateURL(tabs.activeTab);

   // Whenever any new page visited,
   // check to see if it's been highlighted before
   require("sdk/page-mod").PageMod({
     include: "*",
     contentScriptFile: this.api.data.url("hilite.js"),
     contentStyleFile: this.api.data.url("prostetnic.css"),
     onAttach: function (worker) {
      var url = tabs.activeTab.url;
      // console.log("about to call previousHighlights, url="+url);
      var hilites = system.previousHighlights(url);
      if (hilites.length) {
       worker.port.emit("reHilite", JSON.stringify(hilites));
      }
     }
   });

  }

  HighlighterSystem.prototype = {

/*
 * @return incremented value for next hiliteID
 */
   getHiliteID: function () {
    var statement =
     this.dbConn.createStatement("select max(hilitespanid) from hilitespan");
    statement.executeStep();
    return statement.getString(0)-0+1; // Oy Javascript
   },

/*
 * Set value of this.dbConn, so database queries can be made
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
 * Create database tables, if this is the first run
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
 * @return {number} incremented value for next hiliteSpanID
 */
   nextHiliteSpanID: function () {
    var statement =
     this.dbConn.createStatement("select max(hilitespanid) from hilitespan");
    statement.executeStep();
    return statement.getString(0)-0+1;
   },

/*
 * @return {number} id of current URL if in hilite DB, next integer in line if not
 */
   getURLid: function(url) {
    var statement =
     this.dbConn.createStatement("select urlid from url where url = :url");
    statement.params.url = url;
    if (statement.executeStep())
     return statement.getString(0);
    else {
     statement =
      this.dbConn.createStatement("insert into url(url) values (:url)");
     statement.params.url = url;
     statement.executeStep();
     return this.getURLid(url);
    }
   },

/*
 * @param {Highlight} object representing newly-created highlight
 * @return {number} hiliteID of newly posted hilite
 */
   postHighlight: function(hilite) {
    var urlID = this.getURLid(hilite.url.split("#")[0]);
    var statement =
     this.dbConn.createStatement(
      "insert into hilite(urlid, ts, style) values (:urlID, :timeStamp, :style)"
     );
    statement.params.urlID = urlID;
    statement.params.timeStamp = hilite.timeStamp;
    statement.params.style = hilite.style;
    statement.executeStep();
    statement = this.dbConn.createStatement("select max(hiliteid) from hilite");
    statement.executeStep();
    return statement.getString(0);
   },

/*
 * @param {number} hiliteID hiliteID of hiliteSpan
 * @param {HighlightSpan} hiliteSpan a span in most recently created Highlight
 */
   postHighlightSpan: function (hiliteID, hiliteSpan) {
    var statement =
     this.dbConn.createStatement(
      "insert into "+
      "hilitespan(hiliteSpanID, hiliteid, textcontent, startoffset, endoffset)"
      +" values "+
      "(:hiliteSpanID, :hiliteID, :textContent, :startOffset, :endOffset)");
    statement.params.hiliteSpanID = hiliteSpan.hiliteSpanID;
    statement.params.hiliteID = hiliteID;
    statement.params.textContent = hiliteSpan.textContent;
    statement.params.startOffset = hiliteSpan.startOffset;
    statement.params.endOffset = hiliteSpan.endOffset;
    statement.executeStep();
   },

/*
 * @param {number} hiliteID
 * @return {Array} of numbers representing HighlightSpans that are part of
 *  Highlight represented by hiliteID
 */
   spansForHighlight: function (hiliteID) {
    var value = [];
    var statement =
     this.dbConn.createStatement(
      "select hilitespanid, textcontent, startoffset, endoffset "+
      "from hilitespan where hiliteid = :hiliteID"
     );
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
 * @param {String} url of page in active tab
 * @return {Array} of objects representing previous highlights on current page
 */
   previousHighlights: function (url) {
    var value = [], hiliteID;
    var statement =
     this.dbConn.createStatement(
      "select b.hiliteid, b.style from url a, hilite b "+
      "where a.urlid = b.urlid and a.url = :url"
     );
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
 * @return {Array} of hiliteSpanID's of HighlightSpans
 *  in most recently posted Highlight
 */
   spansToUndo: function () {
    var value = [];
    var statement =
     this.dbConn.createStatement(
      "select max(a.hiliteid) from hilite a, url b "+
      "where a.urlid=b.urlid and b.url=:url"
     );
    statement.params.url = this.url;
    if (statement.executeStep()) {
     var hiliteID = statement.getString(0);
     statement = this.dbConn.createStatement(
      "select hilitespanid from hilitespan where hiliteid = :hiliteid"
     );
     statement.params.hiliteid = hiliteID;
     while (statement.executeStep()) {
      value.push(statement.getString(0));
     }
     statement = this.dbConn.createStatement(
      "delete from hilitespan where hiliteid = :hiliteID"
     );
     statement.params.hiliteID = hiliteID;
     statement.executeStep();
     statement = this.dbConn.createStatement(
      "delete from hilite where hiliteid = :hiliteID"
     );
     statement.params.hiliteID = hiliteID;
     statement.executeStep();
    }
    return value;
   },

/*
 * @return {Array} of hiliteSpanID's of all Highlight's in the active tab's page
 */
   spansToErase: function () {
    var innerStatement, hiliteID;
    var value = [];
    var urlID = this.getURLid(this.url);
    var statement = this.dbConn.createStatement(
     "select hiliteid from hilite where urlid=:urlid"
    );
    statement.params.urlid = urlID;
    while (statement.executeStep()) {
     hiliteID = statement.getString(0);
     innerStatement = this.dbConn.createStatement(
      "select hilitespanid from hilitespan where hiliteid=:hiliteID"
     );
     innerStatement.params.hiliteID = hiliteID;
     while (innerStatement.executeStep()) {
      value.push(innerStatement.getString(0));
     }
     innerStatement = this.dbConn.createStatement(
      "delete from hilitespan where hiliteid=:hiliteid"
     );
     innerStatement.params.hiliteid = hiliteID;
     innerStatement.executeStep();
    }
    statement = this.dbConn.createStatement(
     "delete from hilite where urlid=:urlid"
    );
    statement.params.urlid=urlID;
    statement.executeStep();
    return value;
   }

  };

/*
 * Create a statement for a search query, from which one row at a time can be
 * fetched asynchronously.
 * @constructor
 * @param {} dbConn database handle
 * @param {page-worker} worker to add rows
 *  to table of search results in search.html
 */
  function PageSearcher(dbConn, worker, words) {
   this.worker = worker;
   var queryString = "select * from instances where";
   queryString += words.map(function (word) {
     // kludge, not sure how to bind arbitrary number of parameters:
     return " text like \"%"+word+"%\"";
   }).join(" and ");
   this.statement = dbConn.createStatement(queryString);
   this.urlList = [];
  }

  PageSearcher.prototype = {

/*
 * Get a single row from this PageSearcher's query, add it to displayed search
 * results (in search.html) and await either another row, or a change in the
 * content of the input element for search words
 */
   getRow: function () {
    if (this.statement.executeStep()) {
     url = this.statement.getString(1);
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

