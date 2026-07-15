export interface JoinOptions {
  template: string; // 逐行模板，{1}..{N} 代入各列当行
  alignMode: "pad" | "truncate"; // 行数不齐：补空 | 截断
  skipEmptyRows: boolean; // 所有列 trim 后均为空的行不输出
  lineSeparator: string; // 行间连接符（已解转义的最终字面值）
  prefix: string; // 整体前缀
  suffix: string; // 整体后缀
}

// 每列按行切分，并剔除末尾单个空尾行（textarea 粘贴常见残留；中间空行是数据，
// 连续多个尾空行只剔一个——用户显式多敲的空行按数据对待）
// 也用于 UI 列头的行数统计，确保拼接语义对齐
export const toLines = (text: string): string[] => {
  if (text === "") return []; // 仅精确空串规范化为 0 行；空白字符（如 " "）仍算 1 行数据
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
};

export const joinColumns = (columnTexts: string[], options: JoinOptions): string => {
  const { template, alignMode, skipEmptyRows, lineSeparator, prefix, suffix } = options;
  const columns = columnTexts.map(toLines);
  const counts = columns.map((c) => c.length);
  const rowCount = columns.length === 0 ? 0 : alignMode === "truncate" ? Math.min(...counts) : Math.max(...counts);

  const rendered: string[] = [];
  for (let row = 0; row < rowCount; row++) {
    const values = columns.map((col) => col[row] ?? "");
    if (skipEmptyRows && values.every((v) => !v.trim())) continue;
    // 仅替换 {1}..{N}（N=列数）；{0} 或超出列数的占位符原样保留，
    // 模板里的其他花括号文本（如 JSON 字面量）天然安全
    rendered.push(
      template.replace(/\{(\d+)\}/g, (match, d: string) => {
        const idx = Number(d);
        return idx >= 1 && idx <= columns.length ? values[idx - 1] : match;
      }),
    );
  }
  return prefix + rendered.join(lineSeparator) + suffix;
};
