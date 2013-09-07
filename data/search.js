<<<<<<< HEAD
// document.getElementById("search").focus();


=======
>>>>>>> prostetnic/master
window.addEventListener("input", function (event) {
 var tc=document.getElementById("search").value;
 // "Internationalization" on the cheap--
 // Treat every 8+ bit character as alpha:
<<<<<<< HEAD
 var wordArray=tc.split(/'?[\x00-\x26\x28\x29\x3a-\x40\x5b-\x60\x7b-\x7f]+'?/);
=======
 var wordArray=tc.split(/'?[\x00-\x29\x3a-\x40\x5b-\x60\x7b-\x7f]+'?/);
>>>>>>> prostetnic/master
 document.getElementById("search").value=wordArray.join(" ");
 self.port.emit("searchtext", JSON.stringify(wordArray));
}, false);

<<<<<<< HEAD
/*
self.port.on("load", function () {
  document.getElementById("search").focus();
});
*/

window.addEventListener("load", function (event) {
=======
self.port.on("show", function () {
>>>>>>> prostetnic/master
  document.getElementById("search").focus();
});

function trimUrl(url) {
 return url.replace(/^.*\/\//,"").replace(/^www\./,"").replace(/^en\.wikipedia\.org\/wiki\//,"w:");
}

self.port.on("matchingPages", function (queryJson) {
  // alert(queryJson);
  var query=JSON.parse(queryJson);
  var results=document.getElementById("results");
  if (results !== null) {
   document.body.removeChild(results);
  };
  var results=document.createElement("div");
  results.setAttribute("id","results");
  document.body.appendChild(results);
  for (rowno=0; rowno<query.length; rowno++) {
   row=query[rowno];
   ts=row[0];
   url=row[1];
   style=row[2];
   text=row[3];
   
   tsDiv=document.createElement("div");
   tsDiv.setAttribute("class", "ts");
   tsDiv.textContent=ts;
   results.appendChild(tsDiv);
   
   urlDiv=document.createElement("div");
   urlDiv.setAttribute("class", "url");
   urlLink=document.createElement("a");
   urlLink.setAttribute("href", url);
   urlLink.setAttribute("target", "blank");
   urlLink.textContent=trimUrl(url);
   urlDiv.appendChild(urlLink);
   results.appendChild(urlDiv);
   
   textDiv=document.createElement("div");
   textDiv.setAttribute("class", "text");
   textDiv.setAttribute("style", style);
   textDiv.textContent=text;
   results.appendChild(textDiv);
  }
})