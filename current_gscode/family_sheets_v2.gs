/**
 * family_sheets_v2.gs
 *
 * Optimerad version av CreatePrintableSheets.
 *
 * Mål: snabbare än originalet, klara 6-min-gränsen med god marginal,
 * stödja Inges önskemål:
 *   - Tre separata utdatafiler (en per leveransrunda)
 *   - Inom varje fil: grupp → kategori → totalsida + familjesidor
 *   - Per-familj önskad leveranstid på familjesidor (endast Gården)
 *   - Gården får specialordning (TODO: definiera när vi vet exakt vad)
 *
 * Återanvänder: TrimGroupName (från utils_v2.gs)
 *
 * Användning från menyn:
 *   - "Create Family Sheets - File 1 (Maria, Annica, Linnéa, Mygel, Mattias)"
 *   - "Create Family Sheets - File 2 (Frode&Åsa, Irene, Sandra)"
 *   - "Create Family Sheets - File 3 (Gården)"
 *   - "Create Family Sheets - All 3 Files" (kör alla tre i följd)
 */

// Default-texten som hamnar i tids-cellerna när familjen inte fyllt i.
const DEFAULT_TIME_PROMPT_V2 = 'fyll in här önskad leveransdag + tid?';

// Färgpalett (matchar Annika-sheetets)
const COLOR_HEADER_V2     = '#b7e1cd';
const COLOR_ALT_GREEN_V2  = '#d9ead3';
const COLOR_ALT_WHITE_V2  = '#ffffff';

// Definitioner för de tre utdatafilerna
const PRINTABLE_FILES_V2 = [
  {
    fileLabel: 'File1_Maria_Annica_Linnea_Mygel_Mattias',
    groups: ['Maria', 'Annica', 'Linnéa', 'Mygel', 'Mattias'],
    isGarden: false,
    familiesPerPage: 2, // standardlayout: 2 familjer per familjesida
  },
  {
    fileLabel: 'File2_FrodeAsa_Irene_Sandra',
    groups: ['Frode&Åsa', 'Irene', 'Sandra'],
    isGarden: false,
    familiesPerPage: 2,
  },
  {
    fileLabel: 'File3_Garden',
    groups: ['Gården'],
    // 2026-09: Inge vill att Gården ska fungera som övriga grupper.
    // (Sätt isGarden: true + familiesPerPage: 1 för att återgå till specialordningen.)
    isGarden: false,
    familiesPerPage: 2,
  },
];

// ===== Menyfunktioner =====

function CreatePrintableSheets_v2_File1() {
  createPrintableFile_v2(PRINTABLE_FILES_V2[0]);
}
function CreatePrintableSheets_v2_File2() {
  createPrintableFile_v2(PRINTABLE_FILES_V2[1]);
}
function CreatePrintableSheets_v2_File3() {
  createPrintableFile_v2(PRINTABLE_FILES_V2[2]);
}
function CreatePrintableSheets_v2_AllFiles() {
  const t0 = Date.now();
  console.log('CreatePrintableSheets_v2_AllFiles() — start');
  for (let i = 0; i < PRINTABLE_FILES_V2.length; i++) {
    createPrintableFile_v2(PRINTABLE_FILES_V2[i]);
  }
  console.log('AllFiles KLAR på ' + ((Date.now() - t0)/1000).toFixed(1) + ' s');
}

// ===== Huvudlogik =====

/**
 * Skapar en utdatafil med de specificerade grupperna.
 * @param {{fileLabel: string, groups: string[], isGarden: boolean}} cfg
 */
function createPrintableFile_v2(cfg) {
  const t0 = Date.now();
  console.log('--- Skapar utdatafil: ' + cfg.fileLabel + ' ---');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all_sheets = ss.getSheets();

  // Filtrera ut bara de önskade källsheets för denna fil, i den ordning de listas i cfg.groups
  const wantedSheets = [];
  for (let gi = 0; gi < cfg.groups.length; gi++) {
    const wanted = cfg.groups[gi];
    const wantedNorm = normalizeGroupName_v2(wanted);
    const match = all_sheets.find(function (s) {
      return normalizeGroupName_v2(s.getName()) === wantedNorm;
    });
    if (match) {
      wantedSheets.push(match);
    } else {
      // Debug-info: lista alla tillgängliga fliknamn med deras normaliserade form
      const available = all_sheets.map(function (s) {
        return '  "' + s.getName() + '"  →  "' + normalizeGroupName_v2(s.getName()) + '"';
      }).join('\n');
      console.warn(
        'Hittade ingen flik som matchar "' + wanted + '"  (normaliserat: "' + wantedNorm + '")\n' +
        'Tillgängliga flikar (original → normaliserat):\n' + available
      );
    }
  }
  console.log('Matchade ' + wantedSheets.length + ' av ' + cfg.groups.length + ' önskade grupper');

  // Cacha källdata + cell-formatering för hela sheetet. Range.copyTo fungerar inte mellan
  // olika spreadsheets, så vi läser attributen som arrayer och applicerar
  // via setXxx på destinationen (vilket fungerar cross-spreadsheet).
  //
  // Kategori-rader (row_mejeri, row_plantor) beräknas PER KÄLLA — inte från master —
  // eftersom Inge ofta anpassar varje grupp och strukturerna kan skilja sig åt.
  const src_data = wantedSheets.map(function (sheet) {
    const maxCol = sheet.getMaxColumns();
    const maxRow = sheet.getMaxRows();
    const fullRange = sheet.getRange(1, 1, maxRow, maxCol);
    const values = fullRange.getDisplayValues();

    // Hitta kategori-rader specifikt för DENNA källa (genom kol A)
    let rowMejeri = -1;
    let rowPlantor = -1;
    for (let i = 0; i < values.length; i++) {
      const text = String(values[i][0] || '').trim();
      if (rowMejeri < 0 && text === 'Mejeri') rowMejeri = i + 1;
      if (rowPlantor < 0 && text === 'Små Plantor') rowPlantor = i + 1;
    }
    const rowMax = values.length + 1;
    const safeMejeri  = rowMejeri  > 0 ? rowMejeri  : rowMax;
    const safePlantor = rowPlantor > 0 ? rowPlantor : rowMax;

    const categories = [
      { name: 'Vegg',   totals_prefix: 'Veggies: ', family_prefix: 'Vegg: ',
        row_start: 3,            row_end: safeMejeri  },
      { name: 'Meat',   totals_prefix: 'Meat: ',    family_prefix: 'Meat: ',
        row_start: safeMejeri,   row_end: safePlantor },
      { name: 'Plants', totals_prefix: 'Plants: ',  family_prefix: 'Plants: ',
        row_start: safePlantor,  row_end: rowMax      },
    ];

    return {
      name: sheet.getName(),
      maxCol: maxCol,
      maxRow: maxRow,
      values: values,
      // Per-cell formatering för hela sheetet
      fontStyles:           fullRange.getFontStyles(),
      fontWeights:          fullRange.getFontWeights(),
      fontSizes:            fullRange.getFontSizes(),
      horizontalAlignments: fullRange.getHorizontalAlignments(),
      // Källans kolumnbredder
      colWidthA:           sheet.getColumnWidth(1),
      colWidthB:           sheet.getColumnWidth(2),
      colWidthFamilyQty:   maxCol >= 3 ? sheet.getColumnWidth(3) : 80,
      colWidthFamilyText:  maxCol >= 4 ? sheet.getColumnWidth(4) : 150,
      // Kategori-rader specifika för denna källa
      categories: categories,
    };
  });

  // Skapa utdatadokument och flytta till samma mapp som källfilen
  const dest_doc = SpreadsheetApp.create('Printable_' + cfg.fileLabel + '_' + Date());
  moveFileToSourceFolder_v2(ss, dest_doc);
  const defaultSheet = dest_doc.getSheets()[0];

  // Två olika ordningar beroende på fil-typ:
  //  - Normal: per grupp → per kategori → totalsida + alla familjesidor
  //  - Gården: per grupp → alla totaler först → per familjepar → alla 3 kategorier
  for (let si = 0; si < src_data.length; si++) {
    const src = src_data[si];
    const tGroup = Date.now();
    console.log('Grupp: ' + src.name);

    const familyCols = cfg.familiesPerPage * 2;
    const totalFamilyPages = Math.ceil((src.maxCol - 2) / familyCols);

    // Använd KÄLLANS egna kategori-rader (kan skilja sig per grupp)
    const srcCategories = src.categories;

    if (cfg.isGarden) {
      // Gårdens specialordning (används inte just nu — se PRINTABLE_FILES_V2):
      // Inga grupp-totaler. Per familj: alla 3 kategorier i följd.
      for (let i = 0; i < totalFamilyPages; i++) {
        for (let ci = 0; ci < srcCategories.length; ci++) {
          const cat = srcCategories[ci];
          if (isCategoryEnded_v2(src, cat)) continue;
          if (!familyPageHasOrders_v2(src, cat, i, cfg.familiesPerPage)) continue;
          createOneMemberPage_v2(dest_doc, src, cat, i, totalFamilyPages, cfg.familiesPerPage, i + 1);
        }
      }
    } else {
      // Normal ordning: per kategori → totalsida + alla familjesidor
      for (let ci = 0; ci < srcCategories.length; ci++) {
        const cat = srcCategories[ci];
        if (isCategoryEnded_v2(src, cat)) {
          console.log('  Hoppar över ' + cat.name + ' för ' + src.name + ' — "slut för säsongen" upptäckt');
          continue;
        }
        createTotalsPage_v2(dest_doc, src, cat);

        // Ta bara med familjesidor där någon faktiskt har beställt.
        // Numreringen blir löpande över de sidor som skrivs ut (1 of 7, 2 of 7, ...).
        const pagesToPrint = [];
        for (let i = 0; i < totalFamilyPages; i++) {
          if (familyPageHasOrders_v2(src, cat, i, cfg.familiesPerPage)) {
            pagesToPrint.push(i);
          }
        }
        const skipped = totalFamilyPages - pagesToPrint.length;
        if (skipped > 0) {
          console.log('  ' + cat.name + '/' + src.name + ': hoppar över ' + skipped
                    + ' familjesidor utan beställningar (' + pagesToPrint.length + ' skrivs ut)');
        }
        for (let n = 0; n < pagesToPrint.length; n++) {
          createOneMemberPage_v2(dest_doc, src, cat, pagesToPrint[n], pagesToPrint.length,
                                 cfg.familiesPerPage, n + 1);
        }
      }
    }

    console.log('  Grupp ' + src.name + ' klar på ' + ((Date.now() - tGroup)/1000).toFixed(1) + ' s');
  }

  dest_doc.deleteSheet(defaultSheet);

  const elapsed = (Date.now() - t0) / 1000;
  console.log('Fil ' + cfg.fileLabel + ' KLAR på ' + elapsed.toFixed(1) + ' s. URL: ' + dest_doc.getUrl());
}

/**
 * Normaliserar gruppnamn för matchning. Robust mot:
 *   - Versaler/gemener
 *   - Prefixet "grupp"/"Grupp" (med eller utan mellanslag)
 *   - Alla citattecken-varianter (raka, typografiska, apostrofer)
 *   - All whitespace (vanliga mellanslag, icke-brytande, tabbar, mm.)
 *
 * Exempel:
 *   'grupp "Annica"'    → 'annica'
 *   'Grupp Maria'       → 'maria'
 *   'grupp "Irene "'    → 'irene'
 *   'Frode&Åsa'         → 'frode&åsa'
 *   'Grupp "Mattias"'   → 'mattias'
 */
function normalizeGroupName_v2(name) {
  return String(name)
    .toLowerCase()
    // Ta bort "grupp"-prefix (med ev. mellanslag/icke-brytande)
    .replace(/grupp/g, '')
    // Ta bort alla varianter av citattecken och apostrofer
    .replace(/["'‘’“”′″`]/g, '')
    // Ta bort all whitespace (inkl. icke-brytande, tabbar, nya rader)
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Kollar om en kategori är "slut för säsongen" enligt vad som står i kol A
 * inom kategorins rader.
 *
 * VIKTIGT: Matchar endast om cellens HELA innehåll är notisen — alltså
 * en ensam "Slut för säsongen"-rad, inte en produktbeskrivning som råkar
 * innehålla orden (t.ex. "Kirskål. SLUT för säsongen" — då är bara den
 * produkten slut, inte hela kategorin).
 *
 * Fångade varianter (case-insensitive, valfri punktum i slutet, extra mellanslag tolereras):
 *   "Slut för säsong", "Slut för säsongen", "Säsongen slut",
 *   "Säsong slut", "Säsongen är slut", "Säsong är slut"
 *
 * Säker även om källan har färre rader än kategorin förväntar.
 */
/**
 * Kollar om familjesidan `pageIndex` har NÅGON beställning inom kategorin.
 *
 * Räknar både antals-kolumner och fritext-kolumner — en familj som skrivit en
 * notering men inte beställt något får ändå sin sida utskriven.
 *
 * Används för att slippa skriva ut tomma sidor för familjer som inte beställt.
 */
function familyPageHasOrders_v2(src, cat, pageIndex, familiesPerPage) {
  const familyCols = familiesPerPage * 2;
  const srcColStart = 3 + familyCols * pageIndex;
  const endRow = Math.min(cat.row_end, src.values.length + 1);

  for (let r = cat.row_start; r < endRow; r++) {
    const row = src.values[r - 1];
    if (!row) continue;
    for (let c = 0; c < familyCols; c++) {
      const colIdx1 = srcColStart + c;
      if (colIdx1 > src.maxCol) continue;
      const v = row[colIdx1 - 1];
      if (v != null && String(v).trim() !== '') return true;
    }
  }
  return false;
}

function isCategoryEnded_v2(src, cat) {
  const endRow = Math.min(cat.row_end, src.values.length + 1);
  // Matchar HELA cell-innehållet — inte substring i en längre text
  const pattern = /^(slut för säsong(en)?|säsong(en)?( är)? slut)\.?$/;
  for (let r = cat.row_start; r < endRow; r++) {
    const row = src.values[r - 1];
    if (!row) continue;
    const text = String(row[0] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

// ===== Sidskapande =====

/**
 * Skapar en totalsida för en grupp inom en kategori.
 *
 * Layout:
 *   Rad 1: Grupp-header (src rad 1) i kol A
 *   Rad 2: "Beställningslistan stängd..." i kol A, "Total" i kol B
 *   Rad 3+: Kategorins produkter (kol A) + totaler (kol B)
 */
function createTotalsPage_v2(dest_doc, src, cat) {
  const sidnamn = cat.totals_prefix + TrimGroupName(src.name);
  const row_cnt = cat.row_end - cat.row_start;
  const numHeaderRows = 2;

  // Bygg värden: rader 1-2 från källan, sedan kategori-data
  const allRows = [];
  const fontSizes = [];
  const fontWeights = [];
  const fontStyles = [];
  const alignments = [];

  // Hjälpare: src-formatering för (rad, kol), default till säkra värden
  const sz = function (r0, c0) { return (src.fontSizes[r0]    && src.fontSizes[r0][c0]    != null) ? src.fontSizes[r0][c0]    : 12; };
  const wt = function (r0, c0) { return (src.fontWeights[r0]  && src.fontWeights[r0][c0]  != null) ? src.fontWeights[r0][c0]  : 'normal'; };
  const st = function (r0, c0) { return (src.fontStyles[r0]   && src.fontStyles[r0][c0]   != null) ? src.fontStyles[r0][c0]   : 'normal'; };
  const al = function (r0, c0) { return (src.horizontalAlignments[r0] && src.horizontalAlignments[r0][c0] != null) ? src.horizontalAlignments[r0][c0] : 'general'; };

  // Rad 1: src rad 1 (grupp-header)
  allRows.push([src.values[0][0] || '', '']);
  fontSizes.push([sz(0, 0), sz(0, 1)]);
  fontWeights.push([wt(0, 0), wt(0, 1)]);
  fontStyles.push([st(0, 0), st(0, 1)]);
  alignments.push([al(0, 0), al(0, 1)]);

  // Rad 2: src rad 2 ("Beställningslistan stängd..." + "Total")
  allRows.push([src.values[1][0] || '', src.values[1][1] || 'Total']);
  fontSizes.push([sz(1, 0), sz(1, 1)]);
  fontWeights.push([wt(1, 0), wt(1, 1)]);
  fontStyles.push([st(1, 0), st(1, 1)]);
  alignments.push([al(1, 0), al(1, 1)]);

  // Data-rader: src rader cat.row_start till cat.row_end-1
  // Bundet vid src.values.length så vi inte går utanför källans faktiska data
  const dataEndRow = Math.min(cat.row_end, src.values.length + 1);
  for (let r = cat.row_start; r < dataEndRow; r++) {
    const r0 = r - 1;
    allRows.push([src.values[r0][0], src.values[r0][1]]);
    fontSizes.push([sz(r0, 0), sz(r0, 1)]);
    fontWeights.push([wt(r0, 0), wt(r0, 1)]);
    fontStyles.push([st(r0, 0), st(r0, 1)]);
    alignments.push([al(r0, 0), al(r0, 1)]);
  }

  const totalRows = allRows.length;

  const sheet = dest_doc.insertSheet(sidnamn);

  // Skriv alla värden i ETT anrop
  sheet.getRange(1, 1, totalRows, 2).setValues(allRows);

  // Applicera per-cell formatering från källan
  const range = sheet.getRange(1, 1, totalRows, 2);
  range.setFontSizes(fontSizes);
  range.setFontWeights(fontWeights);
  range.setFontStyles(fontStyles);
  range.setHorizontalAlignments(alignments);

  // Vertikal centrering hela sheetet
  range.setVerticalAlignment('middle');

  // WRAP för hela sheetet (bevarar radbrytningar i alla celler)
  range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // Bakgrundsfärger (header + alternerande)
  applyBackgrounds_v2(sheet, totalRows, 2, numHeaderRows);

  // Kolumnbredder från källan
  sheet.setColumnWidth(1, src.colWidthA);
  sheet.setColumnWidth(2, src.colWidthB);

  // Trimma extra kolumner och rader
  const maxC = sheet.getMaxColumns();
  if (maxC > 2) sheet.deleteColumns(3, maxC - 2);
  const maxR = sheet.getMaxRows();
  if (maxR > totalRows) sheet.deleteRows(totalRows + 1, maxR - totalRows);

  sheet.setFrozenColumns(0);
}

/**
 * Skapar EN familjesida för en grupp inom en kategori.
 *
 * Layout per sida (parameteriserad med familiesPerPage):
 *   familiesPerPage=2 (standard): 5 kolumner — produkt | F1 qty | F1 text | F2 qty | F2 text
 *   familiesPerPage=1 (Gården):  3 kolumner — produkt | F qty  | F text
 *
 *   Rad 1: Sidnamn (vår uniform stil)
 *   Rad 2: Grupp-info | familjenamn-celler (från källan)
 *   Rad 3 (endast Gården): "Önskad tid:" | tids-celler
 *   Rad 4+: Produktnamn | familjedata
 *
 * @param {Spreadsheet} dest_doc       Destinationsdokumentet
 * @param {object}      src            Cachat källdata (se src_data i createPrintableFile_v2)
 * @param {object}      cat            Kategori-definition (row_start, row_end, family_prefix)
 * @param {number}      pageIndex      0-baserat index i KÄLLAN (styr vilka kolumner som läses)
 * @param {number}      totalPages     Antal sidor som faktiskt skrivs ut (för "X of Y")
 * @param {number}      familiesPerPage 1 eller 2 (antal familjer per blad)
 * @param {number}      displayNumber  Sidnummer som visas i sidnamnet (1-baserat).
 *                                     Skiljer sig från pageIndex när tomma sidor hoppas över.
 */
function createOneMemberPage_v2(dest_doc, src, cat, pageIndex, totalPages, familiesPerPage, displayNumber) {
  const row_cnt = cat.row_end - cat.row_start;
  const familyCols = familiesPerPage * 2;    // 2 för Gården, 4 för övriga
  const destCols   = 1 + familyCols;         // 3 för Gården, 5 för övriga
  const srcColStart = 3 + familyCols * pageIndex;
  const pageNo = (displayNumber != null) ? displayNumber : (pageIndex + 1);

  const showTimeRow = normalizeGroupName_v2(src.name) === 'gården';
  const sidnamn = cat.family_prefix + TrimGroupName(src.name) + ' ' + pageNo + ' of ' + totalPages;

  // Säker accessor för cell utanför maxCol eller maxRow
  function getCell(rowIdx0, colIdx1) {
    if (colIdx1 > src.maxCol) return '';
    if (rowIdx0 >= src.values.length) return '';
    const row = src.values[rowIdx0];
    if (!row) return '';
    const v = row[colIdx1 - 1];
    return (v === null || v === undefined) ? '' : v;
  }

  // Säkra accessors för formatering
  const sz = function (r0, c0) { return (c0 < src.maxCol && src.fontSizes[r0]    && src.fontSizes[r0][c0]    != null) ? src.fontSizes[r0][c0]    : 12; };
  const wt = function (r0, c0) { return (c0 < src.maxCol && src.fontWeights[r0]  && src.fontWeights[r0][c0]  != null) ? src.fontWeights[r0][c0]  : 'normal'; };
  const st = function (r0, c0) { return (c0 < src.maxCol && src.fontStyles[r0]   && src.fontStyles[r0][c0]   != null) ? src.fontStyles[r0][c0]   : 'normal'; };
  const al = function (r0, c0) { return (c0 < src.maxCol && src.horizontalAlignments[r0] && src.horizontalAlignments[r0][c0] != null) ? src.horizontalAlignments[r0][c0] : 'general'; };

  const uniformRow = function (val) { return new Array(destCols).fill(val); };

  // === Bygg värden + formatering parallellt ===
  const dest = [];
  const fontSizes = [];
  const fontWeights = [];
  const fontStyles = [];
  const alignments = [];

  // RAD 1: sidnamn (uniform 15+bold+center)
  dest.push([sidnamn].concat(new Array(familyCols).fill('')));
  fontSizes.push(uniformRow(15));
  fontWeights.push(uniformRow('bold'));
  fontStyles.push(uniformRow('normal'));
  alignments.push(uniformRow('center'));

  // RAD 2: grupp-info + familjenamn-celler
  const groupHeader = src.values[0][0] || '';
  const familyNamesRow = [];
  for (let c = 0; c < familyCols; c++) {
    familyNamesRow.push(getCell(1, srcColStart + c));
  }
  dest.push([groupHeader].concat(familyNamesRow));

  const row2sizes = [sz(0, 0)];
  const row2weights = [wt(0, 0)];
  const row2styles = [st(0, 0)];
  const row2aligns = [al(0, 0)];
  for (let c = 0; c < familyCols; c++) {
    const srcC = srcColStart + c - 1;  // 0-indexerad
    row2sizes.push(sz(1, srcC));
    row2weights.push(wt(1, srcC));
    row2styles.push(st(1, srcC));
    row2aligns.push(al(1, srcC));
  }
  fontSizes.push(row2sizes);
  fontWeights.push(row2weights);
  fontStyles.push(row2styles);
  alignments.push(row2aligns);

  // RAD 3 (endast Gården): "Önskad tid:" + tids-celler
  if (showTimeRow) {
    const timesRow = [];
    for (let c = 0; c < familyCols; c++) {
      // Endast kvantitetskolumnerna (c=0, 2, ...) bär tid; text-kolumner är tomma
      if (c % 2 === 0) {
        const raw = getCell(0, srcColStart + c);
        timesRow.push((raw === DEFAULT_TIME_PROMPT_V2) ? '' : raw);
      } else {
        timesRow.push('');
      }
    }
    dest.push(['Önskad tid:'].concat(timesRow));

    const row3aligns = ['left'];
    for (let c = 0; c < familyCols; c++) row3aligns.push('center');
    fontSizes.push(uniformRow(15));
    fontWeights.push(uniformRow('bold'));
    fontStyles.push(uniformRow('normal'));
    alignments.push(row3aligns);
  }

  // DATA-RADER: produktnamn + familjedata
  // Bundet vid src.values.length så vi inte går utanför källans faktiska data
  const dataEndRow = Math.min(cat.row_end, src.values.length + 1);
  for (let r = cat.row_start; r < dataEndRow; r++) {
    const r0 = r - 1;
    const familyData = [];
    for (let c = 0; c < familyCols; c++) {
      familyData.push(getCell(r0, srcColStart + c));
    }
    const productName = (src.values[r0] && src.values[r0][0] != null) ? src.values[r0][0] : '';
    dest.push([productName].concat(familyData));

    // Formatering: kol A från källan, övriga kolumner uniformly bold-15-centered
    const rSizes = [sz(r0, 0)];
    const rWeights = [wt(r0, 0)];
    const rStyles = [st(r0, 0)];
    const rAligns = [al(r0, 0)];
    for (let c = 0; c < familyCols; c++) {
      rSizes.push(15);
      rWeights.push('bold');
      rStyles.push('normal');
      rAligns.push('center');
    }
    fontSizes.push(rSizes);
    fontWeights.push(rWeights);
    fontStyles.push(rStyles);
    alignments.push(rAligns);
  }

  const totalRows = dest.length;
  const numHeaderRows = showTimeRow ? 3 : 2;

  // === Skapa sheet och applicera ===
  const sheet = dest_doc.insertSheet(sidnamn);

  sheet.getRange(1, 1, totalRows, destCols).setValues(dest);

  const range = sheet.getRange(1, 1, totalRows, destCols);
  range.setFontSizes(fontSizes);
  range.setFontWeights(fontWeights);
  range.setFontStyles(fontStyles);
  range.setHorizontalAlignments(alignments);
  range.setVerticalAlignment('middle');
  range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  applyBackgrounds_v2(sheet, totalRows, destCols, numHeaderRows);

  // Kolumnbredder från källan
  sheet.setColumnWidth(1, src.colWidthA);
  for (let c = 0; c < familyCols; c++) {
    const destCol = c + 2; // 1-indexerat
    const width = (c % 2 === 0) ? src.colWidthFamilyQty : src.colWidthFamilyText;
    sheet.setColumnWidth(destCol, width);
  }

  // Trimma extra kolumner och rader
  const maxC = sheet.getMaxColumns();
  if (maxC > destCols) sheet.deleteColumns(destCols + 1, maxC - destCols);
  const maxR = sheet.getMaxRows();
  if (maxR > totalRows) sheet.deleteRows(totalRows + 1, maxR - totalRows);
}

/**
 * Flyttar utdatafilen till samma Drive-mapp som källfilen ligger i.
 * Standardbeteendet i SpreadsheetApp.create() är att placera filen i "Min enhet"-roten,
 * vilket sällan är vad användaren vill — den vill ha utdata vid sidan av sin källfil.
 *
 * Kräver att skriptet får DriveApp-behörighet (godkänns vid första körning).
 */
function moveFileToSourceFolder_v2(sourceSpreadsheet, destSpreadsheet) {
  try {
    const sourceFile = DriveApp.getFileById(sourceSpreadsheet.getId());
    const destFile   = DriveApp.getFileById(destSpreadsheet.getId());

    const parents = sourceFile.getParents();
    if (!parents.hasNext()) {
      // Källfilen ligger i rot — utdatafilen blir kvar i rot också
      return;
    }
    const targetFolder = parents.next();
    destFile.moveTo(targetFolder);
  } catch (e) {
    console.warn('Kunde inte flytta utdatafilen till källans mapp: ' + e.message);
  }
}

/**
 * Sätter bakgrundsfärger i ETT setBackgrounds-anrop:
 *   - De första `numHeaderRows` raderna: COLOR_HEADER_V2 (mellangrön)
 *   - Resterande rader: alternerande vit / COLOR_ALT_GREEN_V2 (ljusgrön)
 */
function applyBackgrounds_v2(sheet, totalRows, numCols, numHeaderRows) {
  const colors = [];
  for (let i = 0; i < totalRows; i++) {
    let rowColor;
    if (i < numHeaderRows) {
      rowColor = COLOR_HEADER_V2;
    } else {
      const dataIdx = i - numHeaderRows;
      rowColor = (dataIdx % 2 === 0) ? COLOR_ALT_WHITE_V2 : COLOR_ALT_GREEN_V2;
    }
    const row = new Array(numCols).fill(rowColor);
    colors.push(row);
  }
  sheet.getRange(1, 1, totalRows, numCols).setBackgrounds(colors);
}
