const XLSX = require('C:/intranet/node_modules/xlsx');
const fs = require('fs');

const filePath = "C:/intranet/doc/DOMESIN_ORDER_202603030920.xls";
try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    console.log("SheetNames:", workbook.SheetNames);
    
    workbook.SheetNames.forEach((name, i) => {
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        console.log(`Sheet ${i} ("${name}"): Total rows = ${rows.length}`);
        if (rows.length > 0) {
            console.log(`  First 3 rows:`);
            rows.slice(0, 3).forEach((row, j) => {
                console.log(`    Row ${j} (len ${row.length}):`, row);
            });
        }
    });
} catch (e) {
    console.error("Error:", e);
}
