// 若模板呈「可生成」形状（占位符恰为 {1..k} 连续、相邻分隔全等且不含数字），
// 按 targetColumns 重建占位符序列（扩/截）；否则原样返回。
// no-digit 守卫补的是 k=2 的洞：只有一个相邻对时「分隔一致」平凡成立，无法拦下
// 分隔里含列号的模板（如 JSON 的 c2）——那种误扩会重复键、损坏用户模板。
export const extendTemplate = (template: string, targetColumns: number): string => {
  const target = Math.max(targetColumns, 1);
  const re = /\{(\d+)\}/g;
  const matches: { num: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    matches.push({ num: Number(m[1]), start: m.index, end: m.index + m[0].length });
  }
  const k = matches.length;
  if (k < 2) return template;
  // 占位符必须恰为 1,2,…,k（连续、按序、无重复、无跳号）
  for (let i = 0; i < k; i++) {
    if (matches[i].num !== i + 1) return template;
  }
  // 相邻分隔全等
  const sep = template.slice(matches[0].end, matches[1].start);
  for (let i = 1; i < k - 1; i++) {
    if (template.slice(matches[i].end, matches[i + 1].start) !== sep) return template;
  }
  // 分隔不含数字（拦 k=2 时索引相关分隔，如 JSON 的 c2）
  if (/\d/.test(sep)) return template;
  // 分隔不含配对括号（如 markdown 链接的 `](`）：k=2 uniformity 平凡成立、又不含数字，
  // 误扩会得坏结构 `[{1}]({2}]({3})`。括号类分隔一律不联动（安全固定）。不含 `{}`——那是
  // 占位符定界；SQL 的 `', '`、CSV 的 `,` 等无括号分隔仍正常联动（括号在前后缀不受影响）。
  if (/[()[\]<>]/.test(sep)) return template;
  const pre = template.slice(0, matches[0].start);
  const post = template.slice(matches[k - 1].end);
  const rebuilt = pre + Array.from({ length: target }, (_, i) => `{${i + 1}}`).join(sep) + post;
  return rebuilt === template ? template : rebuilt;
};
