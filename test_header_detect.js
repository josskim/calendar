const XLSX = require('C:/intranet/node_modules/xlsx');
const fs = require('fs');

function testParsing(filePath) {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    console.log(`--- Testing: ${filePath} ---`);
    console.log("Total rows in sheet:", rowsRaw.length);

    // --- 다이나믹 헤더 탐색 로직 (동일하게 구현) ---
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rowsRaw.length, 10); i++) {
        const rowStr = rowsRaw[i].map(c => String(c || "").trim()).join("|");
        if (
            rowStr.includes("주문코드") || 
            rowStr.includes("수취인") || 
            rowStr.includes("상품명") || 
            rowStr.includes("주문번호") ||
            rowStr.includes("받는분") ||
            rowStr.includes("수령인")
        ) {
            headerRowIdx = i;
            break;
        }
    }

    console.log("Detected Header Row Index:", headerRowIdx);
    if (headerRowIdx !== -1) {
        console.log("Header Content:", rowsRaw[headerRowIdx].slice(0, 5), "...");
    }

    const dataRows = rowsRaw.slice(headerRowIdx + 1).filter(row => row.length > 3);
    console.log("Final dataRows count:", dataRows.length);
    if (dataRows.length > 0) {
        console.log("First data row (first 5 cols):", dataRows[0].slice(0, 5));
    }
}

testParsing("C:/intranet/doc/DOMESIN_ORDER_202603030920.xls");
