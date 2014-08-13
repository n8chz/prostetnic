  document.getElementById("commit").addEventListener("click", function (event)
   {
    console.log("click handler for #commit");
    self.port.emit(
     "newStyle",
     document.getElementById("heading").getAttribute("style")
    );
  });


