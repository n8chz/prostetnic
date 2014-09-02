var FindScript = (function () {

  self.port.on("find", function (spansJSON) {
    self.port.emit("done");
  });

  self.on("click", function () {
    self.postMessage("done");
  });

  // events to emit:
  //  "searchTextChange" - whenever #search changes
  //  "nextRow" - whenever #data changes
  // on event:
  //  "newRow" - new data to insert in #data


  // var searchInput = document.getElementById("search"); // because .addEventListener doesn't use the obvious logical thing as 'this'

  if (searchInput = document.getElementById("search")) {
   searchInput.focus(); // because autofocus doesn't seem to work in add-on tabs
   searchInput.addEventListener("input", function (event) { // ?
     var wordArray = searchInput.value.split(/'?[\x00-\x26\x28\x29\x3a-\x40\x5b-\x60\x7b-\x7f]+'?/);
     searchInput.value = wordArray.join(" ");
     // TODO remove all child elements of #data
     if (wordArray.length > 0) {
      var data = document.getElementById("data");
      // h/t http://stackoverflow.com/a/683460/948073
      while(data.firstChild) {
       data.removeChild(data.firstChild);
      }
      self.port.emit("searchTextChange", JSON.stringify(wordArray));
     }
   });
  }

  self.port.on("newRow", function (newRowJSON) {
    var newRow = JSON.parse(newRowJSON);
    var newRowElement = document.createElement("tr");
    var dateCell = document.createElement("td");
    dateCell.textContent = newRow.date;
    dateCell.setAttribute("class", "date");
    newRowElement.appendChild(dateCell);
    var siteCell = document.createElement("td");
    siteCell.setAttribute("class", "link");
    var link = document.createElement("a");
    link.setAttribute("href", newRow.url);
    link.textContent = newRow.url;
    siteCell.appendChild(link);
    newRowElement.appendChild(siteCell);
    var textCell = document.createElement("td");
    textCell.textContent = newRow.text;
    textCell.setAttribute("style", newRow.style);
    textCell.setAttribute("class", "text");
    newRowElement.appendChild(textCell);
    document.getElementById("data").appendChild(newRowElement);
    self.port.emit("nextRow");
  });

})();

