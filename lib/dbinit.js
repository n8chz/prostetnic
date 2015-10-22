var {
  Cc, Ci, Cu
} = require("chrome");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

exports.HilitesDB = function () {
  let file = FileUtils.getFile("ProfD", ["patma.bak.sqlite"]);
  this.dbConn = Services.storage.openDatabase(file);
  var schema = [
    `
      create table if not exists hilite (
        hiliteid integer primary key,
        urlid integer,
        ts integer,
        style varchar,
        foreign key(urlid) references url(urlid)
      )
    `,
    `
      create table if not exists hilitespan (
        hilitespanid integer primary key,
        hiliteid integer,
        textcontent varchar,
        startoffset integer,
        endoffset integer,
        foreign key(hiliteid) references hilite(hiliteid)
      )
    `,
    `
      create table if not exists url (
        urlid integer primary key,
        url varchar
      )
    `,
    `
      create view if not exists instances as
      select datetime(b.ts, "unixepoch", "localtime") ts,
      a.url url,
      b.style style,
      c.textcontent text
      from url a, hilite b, hilitespan c
      where a.urlid=b.urlid
      and b.hiliteid=c.hiliteid
    `,
    `
      create index if not exists tsi on hilite(ts)
    `,
    `
      create unique index if not exists urli on url(url)
    `
  ];
  for (let create of schema) {
    // this.dbConn.createStatement(create).executeAsync({});
    // console.log("trying: "+create);
    this.dbConn.createStatement(create).executeAsync({
        // troubleshooting:
        handleResult: function (aResultSet) {
          console.log("dun");
        },
        handleError: function (aError) {
          console.log("Error: " + aError.message);
        },
        handleCompletion: function (aReason) {
          console.log(aReason);
        }
    });
  }
};

exports.PresetsDB = function () {
  let file = FileUtils.getFile("ProfD", ["patma-presets.sqlite"]);
  this.dbConn = Services.storage.openDatabase(file);
  var schema = [
    `
      create table if not exists button (
        position integer primary key,
        marker integer,
        foreign key(marker) references marker(id)
      )
    `,
    `
      create table if not exists marker (
        id integer primary key,
        backgroundcolor varchar,
        textcolor varchar,
        previous integer,
        foreign key(previous) references marker(id)
      )
    `
  ];
  for (let create of schema) {
    // console.log("trying: "+create);
    this.dbConn.createStatement(create).executeAsync({
        // troubleshooting:
        handleResult: function (aResultSet) {
          console.log("dun");
        },
        handleError: function (aError) {
          console.log("Error: " + aError.message);
        },
        handleCompletion: function (aReason) {
          console.log(aReason);
        }
    });
  }
};

