var ProstetnicHighlighter = (function () {

    var pageMod = require("sdk/page-mod");

    function HighlighterSystem() {

      this.tabs = require("sdk/tabs");

      // initialize database
      var dbinit = require("./dbinit");
      this.hilitesDB = new dbinit.HilitesDB();
      this.presetsDB = new dbinit.PresetsDB();

      // initialize command set
      this.commands = new CommandSet(this);

      // draw UI
      this.ui = new UserInterface(this);

      var system = this;

      // set up page-mod for re-hiliting
      pageMod.PageMod({
          include: ["*"],
          contentScriptFile: "./hilite.js",
          contentStyleFile: undefined,
          onAttach: function (worker) {
            // var url = tabs.activeTab.url;
            var rehilite = require("./rehilite");
            var hilites = rehilite.getPreviousHilites(system, worker);
/*
            if (hilites.length) {
              worker.port.emit("reHilite", JSON.stringify(hilites));
            }
*/
          }
      });

    }

    HighlighterSystem.prototype = {
      previousHighlights: function (url) {}
    };

    function CommandSet(system) {
      this.hiliteSelection = function () {};
      this.selectColor = function () {};
      this.undoMostRecentHilite = function () {};
      this.eraseAllThisPage = function () {};
      this.deleteOneHilite = function () {};
      this.changeOneHilite = function () {};
    }

    function UserInterface(system) {
      for (let command in system.commands) {
        this[command] = {
          button: Button(command),
          menuItem: MenuItem(command),
          hotkey: HotKey(command)
        };
      }
    }

    function Button(command) {}

    function MenuItem(command) {}

    function HotKey(command) {}

    return new HighlighterSystem();

})();
