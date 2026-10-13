import { saveAs } from "file-saver";

import { workbookToBuffer } from "./writer.js";

export const XLSX_MIME =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function saveWorkbook(workbook, fileName) {
    const buffer = await workbookToBuffer(workbook);

    saveAs(new Blob([buffer], { type: XLSX_MIME }), fileName);
}
