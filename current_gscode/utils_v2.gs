/**
 * utils_v2.gs
 *
 * Optimerad version av copyValuesAndFormatting.
 *
 * Användning: kör copyValuesAndFormatting_v2 från menyn.
 *
 * Vad funktionen gör:
 *   - Tar produktlistan (kol A) + totalformler (kol B) från master (första fliken, t.ex. Annica)
 *   - Propagerar dem till alla 8 andra gruppflikar
 *   - Justerar antal rader, radhöjder och kolumnbredder så att grupperna matchar master
 *   - Member-data (kol C och framåt) i grupperna lämnas helt orörd
 *
 * Vad som är optimerat jämfört med originalet:
 *   - appendRow-loop ersatt med insertRowsAfter (1 anrop istället för upp till hundra)
 *   - setRowHeight-loop ersatt med setRowHeights batchat per konsekutivt-samma-höjd
 *   - All formatering läses från master 1 gång och skrivs i batchade plural-anrop
 */

// Kolumnbredder som resetSheetFormatting_v2 sätter (justera här vid behov)
const COL_WIDTH_PRODUCT_V2 = 400; // kol A — produktbeskrivningar
const COL_WIDTH_TOTAL_V2   = 90;  // kol B — Total
const COL_WIDTH_FAMILY_V2  = 140; // kol C+ — familjernas antal- och fritext-kolumner

// Beskrivning som identifierar skyddet vi själva sätter på rad 2
const PROTECT_DESC_V2 = 'Rad 2 (familjenamn) — skyddad av Marcellos-skriptet';

function TrimGroupName(name) {
  return String(name).replace(/grupp /g, '').replace(/Grupp /g, '').replace(/"/g, '');
}

function copyValuesAndFormatting_v2() {
  const t0 = Date.now();
  console.log('copyValuesAndFormatting_v2() — start');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const master = sheets[0];
  console.log('Master: ' + master.getName());

  const masterMaxRows = master.getMaxRows();
  const rowsToCopy = masterMaxRows - 1; // A2:B (sista raden inkluderad)

  // === Läs ALL data från master EN gång ===
  // Notera: vi läser INTE bakgrundsfärger eftersom originalets copyValuesAndFormatting
  // inte propagerar dem. Gruppflikarna har sitt eget alternerande färgmönster
  // (manuellt satt av Inge) som vi vill lämna orört.
  const fromRange = master.getRange(2, 1, rowsToCopy, 2);
  const masterValues               = fromRange.getValues();
  const masterFontFamilies         = fromRange.getFontFamilies();
  const masterFontColors           = fromRange.getFontColors();
  const masterFontSizes            = fromRange.getFontSizes();
  const masterFontStyles           = fromRange.getFontStyles();
  const masterFontWeights          = fromRange.getFontWeights();
  const masterHorizontalAlignments = fromRange.getHorizontalAlignments();
  const masterVerticalAlignments   = fromRange.getVerticalAlignments();
  const masterWraps                = fromRange.getWraps();

  // Formler från B3 och nedåt
  const formulaRowCount = masterMaxRows - 2;
  const masterFormulas = master.getRange(3, 2, formulaRowCount, 1).getFormulas();

  // Kolumnbredder för A och B
  const masterColWidth1 = master.getColumnWidth(1);
  const masterColWidth2 = master.getColumnWidth(2);

  // Radhöjder (per-rad — Apps Script saknar batchläsning för radhöjder)
  const masterRowHeights = [];
  for (let r = 1; r <= masterMaxRows; r++) {
    masterRowHeights.push(master.getRowHeight(r));
  }
  console.log('Master-data läst på ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');

  // === Applicera på varje gruppsheet (alla utom master) ===
  for (let i = 1; i < sheets.length; i++) {
    const target = sheets[i];
    const tSheet = Date.now();
    console.log('Bearbetar: ' + target.getName());

    // 1. Justera antal rader till master:s antal — i ETT anrop, inte i loop
    const targetMaxRows = target.getMaxRows();
    if (targetMaxRows < masterMaxRows) {
      target.insertRowsAfter(targetMaxRows, masterMaxRows - targetMaxRows);
    } else if (targetMaxRows > masterMaxRows) {
      target.deleteRows(masterMaxRows + 1, targetMaxRows - masterMaxRows);
    }

    // 2. Sätt kolumnbredder för A och B
    target.setColumnWidth(1, masterColWidth1);
    target.setColumnWidth(2, masterColWidth2);

    // 3. Sätt radhöjder batchade per konsekutivt-samma-höjd
    applyRowHeightsBatched_v2(target, masterRowHeights);

    // 4. Skriv värden + font/alignment-attribut till A2:B (batchade plurals).
    // Bakgrundsfärger sätts INTE — gruppflikens alternerande färgmönster bevaras.
    const targetRange = target.getRange(2, 1, rowsToCopy, 2);
    targetRange.setValues(masterValues);
    targetRange.setFontFamilies(masterFontFamilies);
    targetRange.setFontColors(masterFontColors);
    targetRange.setFontSizes(masterFontSizes);
    targetRange.setFontStyles(masterFontStyles);
    targetRange.setFontWeights(masterFontWeights);
    targetRange.setHorizontalAlignments(masterHorizontalAlignments);
    targetRange.setVerticalAlignments(masterVerticalAlignments);
    targetRange.setWraps(masterWraps);

    // 5. Skriv formler till B3+ (=SUM(C5:5) etc.)
    target.getRange(3, 2, formulaRowCount, 1).setFormulas(masterFormulas);

    console.log('  ' + target.getName() + ' klar på ' + ((Date.now() - tSheet) / 1000).toFixed(1) + ' s');
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log('copyValuesAndFormatting_v2() KLAR på ' + elapsed.toFixed(1) + ' s');
}

/**
 * Återställer bakgrundsfärger och borders till ett konsekvent mönster på ALLA flikar:
 *
 *   Bakgrunder:
 *     - Rad 1-2: mörkare grön (header)
 *     - Rad 3+: alternerande vit / ljusgrön (data)
 *
 *   Borders:
 *     - Streckade (DASHED) vertikaler inom varje familj
 *     - Medium vertikaler mellan familjer
 *     - Tjock vertikal höger om kol 1 (produkt) och kol 2 (Total)
 *     - Tjock horisontell linje under rad 2 (header → data)
 *
 *   Typsnitt (kol B och alla familjekolumner — INTE kol A):
 *     - Georgia, storlek 16, inte bold, inte italic
 *     - Undantag: rad 2 familjenamn — namnet i fetstil, parentes-koden i icke-fetstil
 *
 *   Alignment:
 *     - Vertikal centrering på hela arket
 *     - Horisontell centrering från kol B och framåt (kol A behåller sin egen)
 *
 *   Kolumnbredder:
 *     - Kol A 400, kol B 90, familjekolumner 140 (se konstanterna högst upp)
 *
 *   Frusna rader/kolumner:
 *     - 2 frusna rader (header alltid synligt)
 *     - 1 fryst kolumn (produktnamn alltid synliga)
 *
 *   Skydd: rörs INTE. Frode och Inge hanterar skyddade rader manuellt i Sheets.
 *
 * Använder konstanterna COLOR_HEADER_V2, COLOR_ALT_GREEN_V2, COLOR_ALT_WHITE_V2
 * från family_sheets_v2.gs.
 *
 * Rör INTE värden, formler, text-formatering, kolumnbredder eller radhöjder.
 * Säkert att köra när som helst för att städa upp utseendet.
 */
function resetSheetFormatting_v2() {
  const t0 = Date.now();
  console.log('resetSheetFormatting_v2() — start');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const structureWarnings = [];

  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    const tSheet = Date.now();
    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    console.log('Återställer: ' + sheet.getName() + ' (' + maxRows + ' × ' + maxCols + ')');

    // Varna om kolumnstrukturen är trasig (extra-kolumn som dyker upp ibland).
    // Familjer upptar 2 kolumner var + kol A/B → totalen ska vara jämn.
    if (maxCols % 2 !== 0) {
      const w = sheet.getName() + ': ojämnt antal kolumner (' + maxCols + ') — trolig extra-kolumn. '
              + 'Familjeparen räknas fel i utskriften tills den tas bort.';
      console.warn('  VARNING: ' + w);
      structureWarnings.push(w);
    }

    try {
      // Städa bort ev. skydd som en tidigare skriptversion satte (era egna rörs inte)
      removeOurProtections_v2(sheet);

      applyConsistentBackgrounds_v2(sheet, maxRows, maxCols);
      applyConsistentBorders_v2(sheet, maxRows, maxCols);
      applyConsistentFonts_v2(sheet, maxRows, maxCols);
      applyConsistentAlignment_v2(sheet, maxRows, maxCols);
      applyConsistentColumnWidths_v2(sheet, maxCols);
      // Rich text sist så att den inte skrivs över av font-/alignment-anropen
      applyRichTextFamilyNames_v2(sheet, maxCols);

      // Frys de två översta raderna och första kolumnen
      sheet.setFrozenRows(2);
      sheet.setFrozenColumns(1);

      console.log('  ' + sheet.getName() + ' klar på ' + ((Date.now() - tSheet) / 1000).toFixed(1) + ' s');
    } catch (e) {
      // Ett trasigt ark ska inte stoppa hela körningen
      const w = sheet.getName() + ': kunde inte formateras — ' + e.message;
      console.warn('  FEL: ' + w);
      structureWarnings.push(w);
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log('resetSheetFormatting_v2() KLAR på ' + elapsed.toFixed(1) + ' s');

  // Visa ev. strukturvarningar för Inge (t.ex. extra-kolumnen som dyker upp)
  if (structureWarnings.length > 0) {
    const msg = 'Formateringen är återställd, men följande behöver kollas för hand:\n\n• '
              + structureWarnings.join('\n• ');
    console.warn(msg);
    try {
      SpreadsheetApp.getUi().alert('Varning: kolumnstruktur', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      // Ingen UI tillgänglig (körning från editorn) — loggen räcker
    }
  }
}

/**
 * Sätter bakgrundsfärger på sheet:
 *   - Rad 1-2: mörkare grön (COLOR_HEADER_V2)
 *   - Rad 3+: alternerande vit / ljusgrön
 * Allt sätts i ett enda setBackgrounds-anrop.
 */
function applyConsistentBackgrounds_v2(sheet, maxRows, maxCols) {
  const backgrounds = [];
  for (let r = 1; r <= maxRows; r++) {
    let color;
    if (r <= 2) {
      color = COLOR_HEADER_V2;
    } else {
      const dataIdx = r - 3;
      color = (dataIdx % 2 === 0) ? COLOR_ALT_WHITE_V2 : COLOR_ALT_GREEN_V2;
    }
    backgrounds.push(new Array(maxCols).fill(color));
  }
  sheet.getRange(1, 1, maxRows, maxCols).setBackgrounds(backgrounds);
}

/**
 * Normaliserar typsnitt på kolumn B (Total) och alla familjekolumner (C och framåt)
 * till en konsekvent stil — Arial 11, inte bold, inte italic.
 *
 * Kolumn A (produktnamn) lämnas helt orörd så att variationen i produkt-
 * beskrivningarna (italic, varierande storlek på sub-rubriker etc.) bevaras.
 *
 * Använder singular-settare på hela ranget — 4 API-anrop per sheet, oavsett storlek.
 */
function applyConsistentFonts_v2(sheet, maxRows, maxCols) {
  if (maxCols < 2) return;
  const range = sheet.getRange(1, 2, maxRows, maxCols - 1);
  range.setFontFamily('Georgia');
  range.setFontSize(16);
  range.setFontWeight('normal');
  range.setFontStyle('normal');
}

/**
 * Sätter alignment konsekvent:
 *   - Vertikal centrering på HELA sheetet (kol A + alla familjekolumner)
 *   - Horisontell centrering på kol B och framåt (Total + alla familjekolumner)
 *
 * Kol A:s horisontella alignment lämnas orörd, eftersom produktbeskrivningar
 * är vänsterställda medan sub-rubriker är centrerade i källan.
 *
 * Detta är fixen för: G9/I7 (Frode), kolumn AS + AO16 (Gården),
 * och Annicas saknade vertikala centrering.
 */
function applyConsistentAlignment_v2(sheet, maxRows, maxCols) {
  // Vertikal centrering överallt
  sheet.getRange(1, 1, maxRows, maxCols).setVerticalAlignment('middle');

  // Horisontell centrering från kol B och framåt
  if (maxCols >= 2) {
    sheet.getRange(1, 2, maxRows, maxCols - 1).setHorizontalAlignment('center');
  }
}

/**
 * Sätter kolumnbredder:
 *   - Kol A: bred (långa produktbeskrivningar)
 *   - Kol B: smal (Total)
 *   - Kol C och framåt: enhetlig bredd som rymmer familjenamn på rad 2
 *
 * Familjekolumnerna sätts i ETT setColumnWidths-anrop, inte ett per kolumn.
 *
 * Detta är fixen för: Mattias kolumner O/Q/S där namnen bröts av.
 */
function applyConsistentColumnWidths_v2(sheet, maxCols) {
  sheet.setColumnWidth(1, COL_WIDTH_PRODUCT_V2);
  if (maxCols >= 2) {
    sheet.setColumnWidth(2, COL_WIDTH_TOTAL_V2);
  }
  if (maxCols >= 3) {
    sheet.setColumnWidths(3, maxCols - 2, COL_WIDTH_FAMILY_V2);
  }
}

/**
 * Städar bort skydd som en TIDIGARE version av skriptet satte på rad 2
 * (identifieras via beskrivningen PROTECT_DESC_V2).
 *
 * Skriptet sätter inte längre några skydd — Frode och Inge hanterar skydd
 * manuellt i Sheets-gränssnittet, vilket fungerar eftersom båda är redigerare.
 * Den här funktionen finns bara för att rensa upp efter buggen som gav
 * "You are trying to edit a protected cell".
 *
 * Skydd som ni satt för hand rörs INTE.
 */
function removeOurProtections_v2(sheet) {
  try {
    const existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].getDescription() === PROTECT_DESC_V2) {
        existing[i].remove();
      }
    }
  } catch (e) {
    console.warn('Kunde inte ta bort skydd på ' + sheet.getName() + ': ' + e.message);
  }
}


/**
 * Applicerar rich text på rad 2 familjenamn-celler (kol 3, 5, 7, ...):
 *   - Delen FÖRE första "(" sätts i fetstil (familjens namn)
 *   - Delen FRÅN "(" och framåt sätts i icke-fetstil (kod-suffixet)
 *
 * Cellens font-family och font-size kommer från applyConsistentFonts_v2
 * (cell-nivå-stil) och påverkas inte av rich text.
 *
 * Om en cell saknar parentes blir hela texten fetstil (familjenamnet hela).
 */
function applyRichTextFamilyNames_v2(sheet, maxCols) {
  if (maxCols < 3) return;

  // Läs hela rad 2 i ETT anrop
  const row2Values = sheet.getRange(2, 1, 1, maxCols).getValues()[0];

  // Familjenamn ligger på udda kolumner från kol 3: 3, 5, 7, ...
  for (let c = 3; c <= maxCols; c += 2) {
    const rawValue = row2Values[c - 1];
    if (!rawValue) continue;
    const text = String(rawValue);

    const parenPos = text.indexOf('(');
    let richText;
    if (parenPos < 0) {
      // Ingen parentes — hela cellen i fetstil
      richText = SpreadsheetApp.newRichTextValue()
        .setText(text)
        .setTextStyle(SpreadsheetApp.newTextStyle().setBold(true).build())
        .build();
    } else {
      // Bold före "(", normal från "(" och framåt
      richText = SpreadsheetApp.newRichTextValue()
        .setText(text)
        .setTextStyle(0, parenPos, SpreadsheetApp.newTextStyle().setBold(true).build())
        .setTextStyle(parenPos, text.length, SpreadsheetApp.newTextStyle().setBold(false).build())
        .build();
    }

    sheet.getRange(2, c).setRichTextValue(richText);
  }
}

/**
 * Sätter borders enligt det önskade mönstret:
 *   - DASHED inom varje familj (mellan kvantitet och fritext)
 *   - SOLID_MEDIUM mellan varje familj (höger om kol 4, 6, 8, ...)
 *   - SOLID_THICK höger om kol 1, kol 2 och under rad 2
 *
 * Strategi: först sätt DASHED på alla inside-vertikaler (1 anrop), sedan
 * överskugga med MEDIUM på familjegränserna och THICK på kol 1/2 och rad 2.
 */
function applyConsistentBorders_v2(sheet, maxRows, maxCols) {
  const fullRange = sheet.getRange(1, 1, maxRows, maxCols);
  const DASHED = SpreadsheetApp.BorderStyle.DASHED;
  const MEDIUM = SpreadsheetApp.BorderStyle.SOLID_MEDIUM;
  const THICK  = SpreadsheetApp.BorderStyle.SOLID_THICK;
  const BLACK  = 'black';

  // 1. Rensa alla befintliga borders
  fullRange.setBorder(false, false, false, false, false, false);

  // 2. DASHED på alla inside-vertikaler (kommer överskuggas där det behövs)
  fullRange.setBorder(null, null, null, null, true, null, BLACK, DASHED);

  // 3. THICK höger om kol 1 (produktnamn → resten)
  sheet.getRange(1, 1, maxRows, 1)
    .setBorder(null, null, null, true, null, null, BLACK, THICK);

  // 4. THICK höger om kol 2 (Total → familjer)
  if (maxCols >= 2) {
    sheet.getRange(1, 2, maxRows, 1)
      .setBorder(null, null, null, true, null, null, BLACK, THICK);
  }

  // 5. MEDIUM mellan varje familj — höger om kol 4, 6, 8, ...
  // (Hoppa över sista kolumnen eftersom det inte finns någon familj efter.)
  for (let c = 4; c < maxCols; c += 2) {
    sheet.getRange(1, c, maxRows, 1)
      .setBorder(null, null, null, true, null, null, BLACK, MEDIUM);
  }

  // 6. THICK under rad 2 (header → data)
  sheet.getRange(2, 1, 1, maxCols)
    .setBorder(null, null, true, null, null, null, BLACK, THICK);
}

/**
 * Sätter radhöjder på target i batchade anrop.
 * Konsekutiva rader med samma höjd grupperas till ETT setRowHeights-anrop
 * istället för ett anrop per rad.
 */
function applyRowHeightsBatched_v2(target, heights) {
  let runStart = 1;
  let runHeight = heights[0];
  // Loop till heights.length + 1 för att stänga sista körningen
  for (let r = 2; r <= heights.length + 1; r++) {
    const h = (r <= heights.length) ? heights[r - 1] : null; // null = sentinel som tvingar stängning
    if (h !== runHeight) {
      const runLength = r - runStart;
      if (runLength > 1) {
        target.setRowHeights(runStart, runLength, runHeight);
      } else {
        target.setRowHeight(runStart, runHeight);
      }
      runStart = r;
      runHeight = h;
    }
  }
}

