// 把剪贴板里的表格文本（Excel / Google Sheets 等复制的 text/plain）解析成 行×列
// 二维数组。列分隔 = Tab，行分隔 = 换行（\r\n 归一为 \n）。遵循电子表格的引号规则：
// 含 Tab / 换行 / 引号的单元格会被 "..." 包裹、内部 " 转义成 ""——所以不能简单 split，
// 否则多行单元格里的换行/Tab 会打乱行列。仅在此状态机下才能正确还原这类单元格。
export const parseTable = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        // "" 是转义的字面引号；单个 " 结束引号段
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      // 引号只在字段起始处开启（电子表格只整格加引号）；字段中途的 " 视为字面量
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // \r\n 里的 \r 跳过，交给 \n 断行
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // 收尾未断行的最后一格
  row.push(field);
  rows.push(row);
  // 丢弃末尾空行（电子表格复制常尾随一个换行 → 多出一行单个空字段）
  if (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === "") rows.pop();
  }
  return rows;
};
