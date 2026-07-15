export interface JoinerPreset {
  id: string;
  name: string;
  template: string;
  lineSeparator: string; // 转义形式（\n 为两字符），与组件内存储一致
  prefix: string;
  suffix: string;
}

export interface JoinerSettings {
  template: string;
  alignMode: "pad" | "truncate";
  skipEmptyRows: boolean;
  lineSeparator: string;
  prefix: string;
  suffix: string;
  columnCount: number;
}

export interface JoinerConfigFile {
  version: 1;
  presets: JoinerPreset[];
  settings: JoinerSettings;
}

// 列数上限：UI（TextJoiner 的 InputNumber max / cols 派生）与导入 sanitize 共用
// 同一常量，避免调上限时漏改一处导致导入静默夹掉多出的列。
export const MAX_COLUMNS = 8;

export const serializeJoinerConfig = (presets: JoinerPreset[], settings: JoinerSettings): string => JSON.stringify({ version: 1, presets, settings }, null, 2);

const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

// 宽松接收、严格产出：缺 template/name 的项判为不可用（返回 null 被过滤）；
// 其余字段类型兜底，缺 id 补序号。
const sanitizePreset = (raw: unknown, index: number): JoinerPreset | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.template !== "string" || typeof r.name !== "string") return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : String(index),
    name: r.name,
    template: r.template,
    lineSeparator: str(r.lineSeparator, "\\n"),
    prefix: str(r.prefix, ""),
    suffix: str(r.suffix, ""),
  };
};

const sanitizeSettings = (raw: unknown): JoinerSettings => {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const n = Number(r.columnCount);
  return {
    template: str(r.template, "{1},{2}"),
    alignMode: r.alignMode === "truncate" ? "truncate" : "pad",
    skipEmptyRows: typeof r.skipEmptyRows === "boolean" ? r.skipEmptyRows : true,
    lineSeparator: str(r.lineSeparator, "\\n"),
    prefix: str(r.prefix, ""),
    suffix: str(r.suffix, ""),
    columnCount: Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), MAX_COLUMNS) : 2,
  };
};

export const parseJoinerConfig = (json: string): JoinerConfigFile => {
  const raw = JSON.parse(json) as unknown; // 非 JSON 抛 SyntaxError，由调用方 catch
  if (typeof raw !== "object" || raw === null) throw new Error("Invalid config: not an object");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.presets)) throw new Error("Invalid config: presets is not an array");
  const presets = r.presets.map((p, i) => sanitizePreset(p, i)).filter((p): p is JoinerPreset => p !== null);
  return { version: 1, presets, settings: sanitizeSettings(r.settings) };
};
