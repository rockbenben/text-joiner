export interface BuiltinPreset {
  key: string;
  template: string;
  lineSeparator: string; // 转义形式（\n 为两字符），执行时统一 parseEscapeChars
  prefix: string;
  suffix: string;
}

// 顺序 = chip 显示顺序；也是 i18n label 的 key。
export const PRESET_KEYS = ["presetCsv", "presetTsv", "presetMarkdownList", "presetMarkdownLink", "presetJsonArray", "presetSqlIn", "presetSqlValues", "presetQuotedCsv"] as const;

// 内置预设 = 一组配置值（模板/连接符/前缀/后缀），模板按当前列数 n 动态生成。
// 模板【不】经 parseEscapeChars（只有连接符/前后缀经过）——所以 TSV 的列分隔用
// 真实 Tab 字符 "\t"，渲染输出即含真 Tab。
export const buildPresets = (n: number): BuiltinPreset[] => {
  const cols = (wrap: (i: number) => string, sep: string) => Array.from({ length: n }, (_, i) => wrap(i + 1)).join(sep);
  return [
    { key: "presetCsv", template: cols((i) => `{${i}}`, ","), lineSeparator: "\\n", prefix: "", suffix: "" },
    { key: "presetTsv", template: cols((i) => `{${i}}`, "	"), lineSeparator: "\\n", prefix: "", suffix: "" },
    { key: "presetMarkdownList", template: `- ${cols((i) => `{${i}}`, " ")}`, lineSeparator: "\\n", prefix: "", suffix: "" },
    { key: "presetMarkdownLink", template: n >= 2 ? "- [{1}]({2})" : "- {1}", lineSeparator: "\\n", prefix: "", suffix: "" },
    { key: "presetJsonArray", template: n === 1 ? `"{1}"` : `{${cols((i) => `"c${i}": "{${i}}"`, ", ")}}`, lineSeparator: ",\\n", prefix: "[\\n", suffix: "\\n]" },
    { key: "presetSqlIn", template: "'{1}'", lineSeparator: ", ", prefix: "IN (", suffix: ")" },
    { key: "presetSqlValues", template: `(${cols((i) => `'{${i}}'`, ", ")})`, lineSeparator: ",\\n", prefix: `INSERT INTO table (${cols((i) => `col${i}`, ", ")}) VALUES\\n`, suffix: ";" },
    { key: "presetQuotedCsv", template: cols((i) => `"{${i}}"`, ","), lineSeparator: "\\n", prefix: "", suffix: "" },
  ];
};
