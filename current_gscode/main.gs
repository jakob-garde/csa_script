function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // Create menu items
  ui.createMenu('Administrative functions')
      .addItem('Copy all items to all sheets [V2]', 'copyValuesAndFormatting_v2')
      .addItem('Återställ formatering (alla flikar) [V2]', 'resetSheetFormatting_v2')
      .addItem('Create Family Sheets - File 1 (Maria, Annica, Linnéa, Mygel, Mattias)', 'CreatePrintableSheets_v2_File1')
      .addItem('Create Family Sheets - File 2 (Frode&Åsa, Irene, Sandra)', 'CreatePrintableSheets_v2_File2')
      .addItem('Create Family Sheets - File 3 (Gården)', 'CreatePrintableSheets_v2_File3')
      .addItem('Create Family Sheets - All Files', 'CreatePrintableSheets_v2_AllFiles')
      .addItem('Create Picking List (Veggies) [V2]', 'CreatePickingListVeggies_v2')
      .addItem('Create Picking List (Dairy & Meats) [V2]', 'CreatePickingListDairyMeat_v2')
      .addItem('Create Picking List (Plants) [V2]', 'CreatePickingListPlants_v2')
      .addToUi();
}

function onEdit() {
  // This function ensures that new sheets created byother users 
  // than the document owner will be deleted.

  var newSheetName = /^Blad[\d]+$/
  var ssdoc = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ssdoc.getSheets();
  
  // is the change made by the owner ?
  if (Session.getActiveUser().getEmail() == ssdoc.getOwner().getEmail()) {
    return;
  }

  // if not the owner, delete all unauthorised sheets
  for (var i = 0; i < sheets.length; i++) {
    if (newSheetName.test(sheets[i].getName())) {
      ssdoc.deleteSheet(sheets[i]);
    }
  }
}
