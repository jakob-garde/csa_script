/**
 * picking_list_v2.gs
 *
 * Optimerad och buggfri version av plocklist-funktionerna.
 *
 * Buggar som fixas vs originalet:
 *   1. Per-källa kategori-rader (inte master:s rader för alla grupper)
 *   2. Produktmatchning per namn (hanterar olika strukturer mellan grupper)
 *   3. Off-by-one i DairyMeat (`row_cnt = row_plants - row_mejeri + 1`)
 *   4. Bug i Plants (`row_cnt = source[0].getMaxRows() - 4 + 1`)
 *   5. `finalizePickingList` summerade rad-för-rad (>200 anrop) → batchat
 *   6. Stavfel `souce` → `source`
 *   7. Dubbel `autoResizeColumn`
 *
 * Återanvänder hjälpare från familj_sheets_v2.gs / utils_v2.gs:
 *   - TrimGroupName (från utils_v2.gs)
 *   - moveFileToSourceFolder_v2 (från utils_v2.gs)
 *   - applyBackgrounds_v2 (från family_sheets_v2.gs)
 *
 * Användning från menyn:
 *   - CreatePickingListVeggies_v2
 *   - CreatePickingListDairyMeat_v2
 *   - CreatePickingListPlants_v2
 */

// Kategori-definitioner (matchar logiken från family_sheets_v2.gs)
const PICK_CAT_VEGG_V2   = { name: 'Veggies', label: 'Veggies', fileLabel: 'Veggies' };
const PICK_CAT_MEAT_V2   = { name: 'Meat',    label: 'Dairy & Meat', fileLabel: 'Meat' };
const PICK_CAT_PLANTS_V2 = { name: 'Plants',  label: 'Plants', fileLabel: 'Plants' };

// ===== Menyfunktioner =====

function CreatePickingListVeggies_v2() {
  createPickingList_v2(PICK_CAT_VEGG_V2);
}
function CreatePickingListDairyMeat_v2() {
  createPickingList_v2(PICK_CAT_MEAT_V2);
}
function CreatePickingListPlants_v2() {
  createPickingList_v2(PICK_CAT_PLANTS_V2);
}

// ===== Huvudlogik =====

function createPickingList_v2(category) {
  const t0 = Date.now();
  console.log('createPickingList_v2(' + category.name + ') — start');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  // === Cacha per källa, med per-källa kategori-rader ===
  const sourceData = sheets.map(function (sheet) {
    const maxCol = sheet.getMaxColumns();
    const maxRow = sheet.getMaxRows();
    const fullRange = sheet.getRange(1, 1, maxRow, maxCol);
    const values = fullRange.getDisplayValues();
    // Formler läses också så vi kan upptäcka produkter (har SUM-formel i B) vs
    // notiser (saknar formel i B). Mer robust än att enbart läsa display-värdet,
    // som kan dölja nollor beroende på cellformat.
    const formulas = fullRange.getFormulas();

    // Hitta Mejeri och Små Plantor i DENNA källas kol A
    let rowMejeri = -1, rowPlantor = -1;
    for (let i = 0; i < values.length; i++) {
      const text = String(values[i][0] || '').trim();
      if (rowMejeri < 0 && text === 'Mejeri') rowMejeri = i + 1;
      if (rowPlantor < 0 && text === 'Små Plantor') rowPlantor = i + 1;
    }
    const rowMax = values.length + 1;
    const safeMejeri  = rowMejeri  > 0 ? rowMejeri  : rowMax;
    const safePlantor = rowPlantor > 0 ? rowPlantor : rowMax;

    // Avgör kategorins rad-intervall
    let catStart, catEnd;
    if (category.name === 'Veggies') {
      catStart = 3;
      catEnd = safeMejeri;
    } else if (category.name === 'Meat') {
      catStart = safeMejeri;
      catEnd = safePlantor;
    } else {
      // Plants
      catStart = safePlantor;
      catEnd = rowMax;
    }

    // Bygg produktlista + totals-map + formel-map för denna källa
    const products = [];
    const totals = {};
    const hasFormulaMap = {};
    for (let r = catStart; r < catEnd; r++) {
      if (r - 1 >= values.length) break;
      const row = values[r - 1];
      if (!row) continue;
      const name = String(row[0] || '').trim();
      if (!name) continue;
      const totalRaw = row[1];
      if (!(name in totals)) {
        products.push(name);
      }
      totals[name] = totalRaw;
      // True om kol B har en formel (=SUM(...)) — säkrare signal på "produkt" än värde
      const formulaB = (formulas[r - 1] && formulas[r - 1][1]) ? formulas[r - 1][1] : '';
      hasFormulaMap[name] = hasFormulaMap[name] || !!formulaB;
    }

    return {
      name: sheet.getName(),
      cleanName: TrimGroupName(sheet.getName()),
      products: products,
      totals: totals,
      hasFormulaMap: hasFormulaMap,
    };
  });

  // === Slå samman produkter över alla källor, bevara ordningen från första förekomsten ===
  const allProducts = [];
  const seen = {};
  for (let si = 0; si < sourceData.length; si++) {
    const src = sourceData[si];
    for (let pi = 0; pi < src.products.length; pi++) {
      const p = src.products[pi];
      if (!seen[p]) {
        allProducts.push(p);
        seen[p] = true;
      }
    }
  }
  console.log('Sammanslog ' + allProducts.length + ' unika produkter över ' + sourceData.length + ' grupper');

  // === Bygg utdata-tabellen ===
  // Layout:
  //   Rad 1: tom (visuell space)
  //   Rad 2: '' | 'Total' | G1 | G2 | ... | G9
  //   Rad 3+: produktnamn | radens summa | G1 total | G2 total | ... | G9 total
  const totalCols = 2 + sourceData.length;
  const totalRowsHeader = 2;

  const headerRow1 = new Array(totalCols).fill('');
  const headerRow2 = ['', 'Total'];
  for (let i = 0; i < sourceData.length; i++) {
    headerRow2.push(sourceData[i].cleanName);
  }

  const dataRows = [];
  let skippedNotices = 0;
  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i];
    let rowSum = 0;
    let hasAnyValue = false;
    let hasFormula = false;
    const groupValues = [];
    for (let si = 0; si < sourceData.length; si++) {
      const val = sourceData[si].totals[product];
      const num = (val === '' || val == null) ? 0 : (Number(val) || 0);
      rowSum += num;
      if (val != null && val !== '') hasAnyValue = true;
      if (sourceData[si].hasFormulaMap[product]) hasFormula = true;
      groupValues.push(val == null ? '' : val);
    }

    // Filtrera bort långa notiser. Krav för att vara en notis:
    //   - INGEN grupp har ett synligt värde (`hasAnyValue` = false)
    //   - INGEN grupp har en formel i kol B (`hasFormula` = false) — utesluter
    //     produkter där SUM råkar visa tomt pga formatering
    //   - Texten är längre än 80 tecken (för att inte filtrera korta sub-rubriker)
    if (!hasAnyValue && !hasFormula && product.length > 80) {
      skippedNotices++;
      continue;
    }

    const row = [product];
    // Visa endast positiva summor; tomt vid 0 för läsbarhet
    row.push(rowSum > 0 ? rowSum : '');
    for (let gi = 0; gi < groupValues.length; gi++) {
      row.push(groupValues[gi]);
    }
    dataRows.push(row);
  }
  if (skippedNotices > 0) {
    console.log('Hoppade över ' + skippedNotices + ' långa notis-rader (utan värden eller formler)');
  }

  const allRows = [headerRow1, headerRow2].concat(dataRows);
  const totalRows = allRows.length;

  // === Skapa utdata-dokument ===
  const destDoc = SpreadsheetApp.create('Picklist_' + category.fileLabel + '_v2_' + Date());
  moveFileToSourceFolder_v2(ss, destDoc);
  const sheet = destDoc.getSheets()[0];

  // Skriv alla värden i ETT anrop
  sheet.getRange(1, 1, totalRows, totalCols).setValues(allRows);

  // === Formatering ===
  const range = sheet.getRange(1, 1, totalRows, totalCols);
  range.setFontSize(15);
  range.setFontWeight('bold');
  range.setVerticalAlignment('middle');

  // Kol 1: vänsterställd + WRAP (långa produktbeskrivningar)
  sheet.getRange(1, 1, totalRows, 1)
    .setHorizontalAlignment('left')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // Kol 2+: centrerade siffror med OVERFLOW
  sheet.getRange(1, 2, totalRows, totalCols - 1)
    .setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.OVERFLOW);

  // Bakgrundsfärger: rad 1-2 mörkare grön (header), rad 3+ alternerande
  applyBackgrounds_v2(sheet, totalRows, totalCols, totalRowsHeader);

  // Kolumnbredder
  sheet.setColumnWidth(1, 400);
  for (let c = 2; c <= totalCols; c++) {
    sheet.setColumnWidth(c, 90);
  }

  // Trimma extra rader och kolumner
  const maxC = sheet.getMaxColumns();
  if (maxC > totalCols) sheet.deleteColumns(totalCols + 1, maxC - totalCols);
  const maxR = sheet.getMaxRows();
  if (maxR > totalRows) sheet.deleteRows(totalRows + 1, maxR - totalRows);

  // Frys första 2 raderna och första 2 kolumnerna (produktnamn + Total)
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(2);

  const elapsed = (Date.now() - t0) / 1000;
  console.log('createPickingList_v2(' + category.name + ') KLAR på ' + elapsed.toFixed(1) + ' s');
  console.log('URL: ' + destDoc.getUrl());
}

