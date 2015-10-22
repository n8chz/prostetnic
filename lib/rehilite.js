exports.getPreviousHilites = function (system, worker) {
  var url = "http:"+system.tabs.activeTab.url.split(":")[1].split("#")[0];
  var statement = system.hilitesDB.dbConn.createStatement(`
      select b.hiliteid hiliteid, b.style style
      from url a, hilite b
      where a.urlid=b.urlid
      and a.url=:url
  `);
  console.log("statement created");
  statement.params.url = url;
  statement.executeAsync({
      handleResult: function (aResult) {
        console.log("In outer executeAsync's handleResult");
        for (let row = aResult.getNextRow(); row; row = aResult.getNextRow()) {
          let hilite = {
            hiliteID: row.getResultByName("hiliteid"),
            style: row.getResultByName("style"),
            hiliteSpans: []
          };
          console.log("hilite: "+hilite);
          var innerStatement = system.hilitesDB.dbConn.createStatement(`
              select hilitespanid, textcontent, startoffset, endoffset
              from hilitespan
              where hiliteid = :hiliteID
          `);
          innerStatement.params.hiliteID = hilite.hiliteID;
          innerStatement.executeAsync({
              handleResult: function (aResult) {
                  for (let row = aResult.getNextRow(); row; row = aResult.getNextRow()) {
                    var span = {
                      hiliteSpanID: row.getResultByName("hilitespanid"),
                      textContent: row.getResultByName("textcontent"),
                      startOffset: row.getResultByName("startoffset"),
                      endOffset: row.getResultByName("endoffset") 
                    };
                    hilite.hiliteSpans.push(span);
                  }
              },
              handleCompletion: function (aReason) {
                // All hilites for this url retrieved
                console.log("Hilite found: "+JSON.stringify(hilite));
                worker.port.emit("reHilite", JSON.stringify([hilite]));
              }
          });
        }
      },
      handleCompletion: function (aReason) {
        console.log("in outer executeAsync's handleCompletion");
      }
  });
};

