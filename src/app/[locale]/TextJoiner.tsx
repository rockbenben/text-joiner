"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Button, Input, InputNumber, Typography, Form, Space, Segmented, Switch, Flex, Row, Col, Tooltip, Divider, Select, Modal, Popconfirm, theme, App, type GetRef } from "antd";
import { SettingOutlined, InboxOutlined, ClearOutlined, MergeCellsOutlined, ExperimentOutlined, PlusOutlined, SaveOutlined, DeleteOutlined, ImportOutlined, ExportOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageCard from "@/app/components/styled/PageCard";
import ResultCard from "@/app/components/ResultCard";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import { useTextStats } from "@/app/hooks/useTextStats";
import { downloadFile, parseEscapeChars } from "@/app/utils";
import { joinColumns, toLines, type JoinOptions } from "./joinColumns";
import { useJoinerPresets } from "./useJoinerPresets";
import { serializeJoinerConfig, parseJoinerConfig, MAX_COLUMNS, type JoinerSettings } from "./joinerConfig";
import { buildPresets, type BuiltinPreset } from "./joinerPresetsDefs";
import { extendTemplate } from "./extendTemplate";
import { parseTable } from "./parseTable";

const { TextArea } = Input;
const { Text } = Typography;

// 语言中立的示例数据（名字 + 数量），一眼演示「逐行对齐 + 套模板」，无需按语种翻译
const EXAMPLE_COLUMNS = ["Alice\nBob\nCarol", "12\n15\n9"];

// 预设行内预览：用每列 2 行的样例跑一遍，展示实际产出形状（a1/a2、b1/b2…）
const previewColumns = (n: number) => Array.from({ length: n }, (_, i) => `${String.fromCharCode(97 + i)}1\n${String.fromCharCode(97 + i)}2`);

const TextJoiner = () => {
  const t = useTranslations("TextJoiner");
  const tCommon = useTranslations("common");
  const { token } = theme.useToken();
  const { copyToClipboard } = useCopyToClipboard();
  const { message } = App.useApp();
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const [columnCount, setColumnCount] = useLocalStorage("text-joiner-columnCount", 2);
  // 列内容不持久化（可能是大文本），刷新即清
  const [columnValues, setColumnValues] = useState<string[]>([]);
  const [template, setTemplate] = useLocalStorage("text-joiner-template", "{1},{2}");
  const [alignMode, setAlignMode] = useLocalStorage<"pad" | "truncate">("text-joiner-alignMode", "pad");
  const [skipEmptyRows, setSkipEmptyRows] = useLocalStorage("text-joiner-skipEmptyRows", true);
  const [lineSeparator, setLineSeparator] = useLocalStorage("text-joiner-lineSeparator", "\\n");
  const [prefix, setPrefix] = useLocalStorage("text-joiner-prefix", "");
  const [suffix, setSuffix] = useLocalStorage("text-joiner-suffix", "");
  // 当前"活"的内置预设 key（空=无）。驱动 chip 高亮 + 改列数时模板联动重生。
  const [activeBuiltinKey, setActiveBuiltinKey] = useLocalStorage("text-joiner-activeBuiltinKey", "");
  // Excel/表格粘贴自动拆列。默认开（常见诉求）；关掉则含 Tab 文本整块进单框（逃生舱）。
  const [autoSplitPaste, setAutoSplitPaste] = useLocalStorage("text-joiner-autoSplitPaste", true);

  // 点列头 {N} 芯片把占位符插到模板光标处：需拿到 textarea DOM 读/写选区
  const templateRef = useRef<GetRef<typeof TextArea>>(null);
  const pendingCaret = useRef<number | null>(null);

  // 渲染始终以 cols 为准：columnCount 越界钳到 1..MAX，缺位的内容取空串
  const colCount = Math.min(Math.max(columnCount, 1), MAX_COLUMNS);
  const cols = useMemo(() => Array.from({ length: colCount }, (_, i) => columnValues[i] ?? ""), [colCount, columnValues]);
  const presets = useMemo(() => buildPresets(cols.length), [cols.length]);

  // 已解转义的最终选项（UI 层负责 parseEscapeChars，纯函数收到字面值）
  const options: JoinOptions = useMemo(
    () => ({ template, alignMode, skipEmptyRows, lineSeparator: parseEscapeChars(lineSeparator), prefix: parseEscapeChars(prefix), suffix: parseEscapeChars(suffix) }),
    [template, alignMode, skipEmptyRows, lineSeparator, prefix, suffix]
  );

  const hasContent = cols.some((c) => c.trim());
  // 实时结果：有内容且模板非空才计算；空结果的三种成因由输出区分别提示
  const result = useMemo(() => (hasContent && template ? joinColumns(cols, options) : ""), [hasContent, template, cols, options]);
  const resultStats = useTextStats(result);

  const joinerPresets = useJoinerPresets({ template, lineSeparator, prefix, suffix, setTemplate, setLineSeparator, setPrefix, setSuffix });

  const handleExport = () => {
    const settings: JoinerSettings = { template, alignMode, skipEmptyRows, lineSeparator, prefix, suffix, columnCount: cols.length };
    downloadFile(serializeJoinerConfig(joinerPresets.presets, settings), "text-joiner-config.json", "application/json");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const cfg = parseJoinerConfig(await file.text());
        joinerPresets.setPresets(cfg.presets);
        joinerPresets.setActivePresetId(""); // 旧 active 可能指向已不存在的模板
        setActiveBuiltinKey(""); // 导入应用自己的模板，脱离活内置预设
        const s = cfg.settings;
        setTemplate(s.template);
        setAlignMode(s.alignMode);
        setSkipEmptyRows(s.skipEmptyRows);
        setLineSeparator(s.lineSeparator);
        setPrefix(s.prefix);
        setSuffix(s.suffix);
        setColumnCount(s.columnCount);
        message.success(t("importSuccess"));
      } catch (e) {
        message.error(t("importFailed", { error: e instanceof Error ? e.message : String(e) }));
      }
    };
    input.click();
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.error(t("presetNameRequired"));
      return;
    }
    joinerPresets.saveAs(presetName.trim());
    setPresetModalOpen(false);
    message.success(t("presetSaved"));
  };

  const setColumnValue = (index: number, value: string) =>
    setColumnValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  const getTemplateEl = (): HTMLTextAreaElement | null => templateRef.current?.resizableTextArea?.textArea ?? null;

  // 点 {N} 芯片插入占位符：聚焦时插到光标处（替换选区），未聚焦则追加到末尾。
  // 记下目标光标位，待 template 提交后由 effect 恢复焦点与光标，方便连续插/编辑。
  const insertPlaceholder = (n: number) => {
    const token = `{${n}}`;
    const el = getTemplateEl();
    const focused = !!el && document.activeElement === el;
    const start = focused ? el.selectionStart : template.length;
    const end = focused ? el.selectionEnd : template.length;
    pendingCaret.current = start + token.length;
    setTemplate(template.slice(0, start) + token + template.slice(end));
    setActiveBuiltinKey(""); // 手动编辑，脱离活内置预设
  };

  useEffect(() => {
    const pos = pendingCaret.current;
    if (pos == null) return;
    pendingCaret.current = null;
    const el = getTemplateEl();
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  }, [template]);

  // 从 Excel/表格复制的多列是 TSV（列 Tab、行换行）。粘贴内容含 Tab 即当整张表：
  // 拆列铺到各列框、列数联动（模板随之扩/截）。不含 Tab 的普通粘贴走默认（进单框）。
  // 整表粘贴一律从第 1 列铺起（与粘到哪个框无关），并替换现有各列内容。
  const handleColumnPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!autoSplitPaste) return;
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t")) return;
    e.preventDefault();
    const grid = parseTable(text);
    const srcWidth = Math.max(...grid.map((r) => r.length));
    const width = Math.min(srcWidth, MAX_COLUMNS);
    setColumnValues(Array.from({ length: width }, (_, j) => grid.map((r) => r[j] ?? "").join("\n")));
    changeColumnCount(width); // 复用列数联动：内置预设重生 / 手打模板按形状扩截
    if (srcWidth > MAX_COLUMNS) message.warning(t("pasteClamped", { count: srcWidth, max: MAX_COLUMNS }));
    else message.success(t("pasteSuccess", { rows: grid.length, cols: width }));
  };

  const applyBuiltin = (p: BuiltinPreset) => {
    setTemplate(p.template);
    setLineSeparator(p.lineSeparator);
    setPrefix(p.prefix);
    setSuffix(p.suffix);
    setActiveBuiltinKey(p.key); // 该内置预设变"活"（高亮 + 后续随列数联动）
    joinerPresets.setActivePresetId(""); // 内置与自定义互斥，避免「更新」误覆盖自定义
  };

  // 改列数：设新值后，若有活内置预设，按新列数重生其四字段（模板联动）。
  const changeColumnCount = (n: number) => {
    const clamped = Math.min(Math.max(n, 1), MAX_COLUMNS);
    setColumnCount(clamped);
    if (activeBuiltinKey) {
      const p = buildPresets(clamped).find((x) => x.key === activeBuiltinKey);
      if (p) applyBuiltin(p);
    } else {
      // 手打/自定义模板：可生成形状则随列数扩/截（不动连接符/前后缀）。
      // 直接 setter，不经模板 onChange，故不改 activeBuiltinKey（本分支下已空）。
      const t = extendTemplate(template, clamped);
      if (t !== template) setTemplate(t);
    }
  };

  const loadExample = () => {
    changeColumnCount(2);
    setColumnValues(EXAMPLE_COLUMNS);
  };

  const presetPreview = (p: (typeof presets)[number]) =>
    joinColumns(previewColumns(cols.length), {
      template: p.template,
      alignMode: "pad",
      skipEmptyRows: false,
      lineSeparator: parseEscapeChars(p.lineSeparator),
      prefix: parseEscapeChars(p.prefix),
      suffix: parseEscapeChars(p.suffix),
    });

  const sectionLabel = (text: string) => (
    <Text type="secondary" className="!mb-2 !block !text-xs !font-medium !tracking-wide">
      {text}
    </Text>
  );

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* 左：列输入 */}
        <Col xs={24} lg={16}>
          <PageCard
            title={
              <Space>
                <InboxOutlined /> {t("columnsTitle")}
              </Space>
            }
            extra={
              <Space wrap>
                {/* 列数放在它作用的列区旁边；减小列数不截断内容：超出列休眠保留，
                    调回即恢复，输出只读取前 N 列（cols 派生） */}
                <Space size={4}>
                  <Text type="secondary" className="!text-xs">
                    {t("columnCount")}
                  </Text>
                  <InputNumber
                    size="small"
                    min={1}
                    max={MAX_COLUMNS}
                    precision={0}
                    value={cols.length}
                    onChange={(value) => changeColumnCount(value ?? 1)}
                    className="!w-16"
                    aria-label={t("columnCount")}
                  />
                </Space>
                <Button type="text" danger size="small" icon={<ClearOutlined />} disabled={!hasContent} onClick={() => setColumnValues([])} aria-label={tCommon("clearAll")}>
                  {tCommon("clearAll")}
                </Button>
              </Space>
            }>
            {/* 开关兼发现性：一行说明整表粘贴入口，Switch 让不想拆列的人关掉（逃生舱） */}
            <Flex align="center" gap={8} className="!mb-3">
              <Switch size="small" checked={autoSplitPaste} onChange={setAutoSplitPaste} aria-label={t("autoSplitPaste")} />
              <Text type="secondary" className="!text-xs">
                {t("pasteHint")}
              </Text>
            </Flex>
            <Row gutter={[16, 16]}>
              {cols.map((val, i) => (
                <Col xs={24} md={cols.length === 1 ? 24 : 12} key={i}>
                  <Flex justify="space-between" align="center" className="!mb-1">
                    {/* {N} 用强调色对应右侧模板占位符；点击即把该占位符插到模板光标处，
                        把这个招牌 motif 变成真控件（onMouseDown 阻断默认，保住模板焦点与光标） */}
                    <Tooltip title={t("insertPlaceholder", { num: i + 1 })}>
                      <Text
                        code
                        role="button"
                        tabIndex={0}
                        aria-label={t("insertPlaceholder", { num: i + 1 })}
                        className="!text-sm !cursor-pointer transition-opacity hover:!opacity-70"
                        style={{ color: token.colorPrimary }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertPlaceholder(i + 1)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            insertPlaceholder(i + 1);
                          }
                        }}>
                        {`{${i + 1}}`}
                      </Text>
                    </Tooltip>
                    <Text type="secondary" className="!text-xs">
                      {t("lineCount", { count: toLines(val).length })}
                    </Text>
                  </Flex>
                  <TextArea rows={8} value={val} onChange={(e) => setColumnValue(i, e.target.value)} onPaste={handleColumnPaste} placeholder={t("columnPlaceholder", { num: i + 1 })} aria-label={`{${i + 1}}`} />
                </Col>
              ))}
            </Row>
          </PageCard>
        </Col>

        {/* 右：配置（输出格式 / 处理方式两组） */}
        <Col xs={24} lg={8}>
          <PageCard
            title={
              <Space>
                <SettingOutlined /> {tCommon("configuration")}
              </Space>
            }
            extra={
              <Space>
                <Tooltip title={t("importConfig")}>
                  <Button size="small" type="text" icon={<ImportOutlined />} onClick={handleImport} aria-label={t("importConfig")} />
                </Tooltip>
                <Tooltip title={t("exportConfig")}>
                  <Button size="small" type="text" icon={<ExportOutlined />} onClick={handleExport} aria-label={t("exportConfig")} />
                </Tooltip>
              </Space>
            }>
            <Form layout="vertical" className="[&_.ant-form-item]:!mb-3">
              {/* 首组(模板/预设/我的模板)是面板主内容，字段标签「逐行模板」已命名，
                  不再顶一个与之重复的「逐行格式」小标题；小标题只留给下面两个次级组 */}
              <Form.Item label={t("template")}>
                {/* 最高频编辑、内容是代码式（{1},{2}、括号、Tab）——等宽 + 加大 + 更高，
                    做配置面板的焦点控件，与列头 {N} chip / 预设预览 / 结构提示的等宽风格统一 */}
                <TextArea ref={templateRef} autoSize={{ minRows: 2, maxRows: 8 }} className="!font-mono !text-base" value={template} onChange={(e) => { setTemplate(e.target.value); setActiveBuiltinKey(""); }} aria-label={t("template")} />
                {/* 语法提示紧贴字段（不再用 help 落到预设下方，读序回到 字段→怎么用→预设） */}
                <Text type="secondary" className="!mt-1 !block !text-xs">
                  {t("templateHint")}
                </Text>
                {/* 预设是次级快捷入口：用无边框 text 收敛权重，让主控件模板与下方真正的设置
                    项不被一排带框按钮压过；保留名称与悬停预览。选中项 primary 高亮。 */}
                <Flex wrap gap={4} className="!mt-2">
                  {presets.map((p) => (
                    <Tooltip key={p.key} title={<pre className="!m-0 !whitespace-pre-wrap !font-mono !text-xs">{presetPreview(p)}</pre>}>
                      <Button size="small" type={activeBuiltinKey === p.key ? "primary" : "text"} onClick={() => applyBuiltin(p)}>
                        {t(p.key)}
                      </Button>
                    </Tooltip>
                  ))}
                </Flex>
              </Form.Item>

              <Form.Item label={t("myTemplates")}>
                <Space.Compact style={{ width: "100%" }}>
                  <Select
                    style={{ flex: 1 }}
                    placeholder={t("presetSelectPlaceholder")}
                    aria-label={t("myTemplates")}
                    value={joinerPresets.activePresetId || undefined}
                    onChange={(v) => { joinerPresets.load(v); setActiveBuiltinKey(""); }}
                    allowClear
                    onClear={() => { joinerPresets.load(""); setActiveBuiltinKey(""); }}
                    options={joinerPresets.presets.map((p) => ({ label: p.name, value: p.id }))}
                  />
                  <Tooltip title={t("presetSaveAs")}>
                    <Button
                      icon={<PlusOutlined />}
                      aria-label={t("presetSaveAs")}
                      onClick={() => {
                        setPresetName("");
                        setPresetModalOpen(true);
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t("presetUpdate")}>
                    <Button
                      icon={<SaveOutlined />}
                      disabled={!joinerPresets.activePresetId}
                      aria-label={t("presetUpdate")}
                      onClick={() => {
                        joinerPresets.updateActive();
                        message.success(t("presetUpdated"));
                      }}
                    />
                  </Tooltip>
                  <Popconfirm
                    title={t("presetDeleteConfirm")}
                    disabled={!joinerPresets.activePresetId}
                    onConfirm={() => {
                      joinerPresets.remove(joinerPresets.activePresetId);
                      message.success(t("presetDeleted"));
                    }}>
                    <Tooltip title={t("presetDelete")}>
                      <Button danger icon={<DeleteOutlined />} disabled={!joinerPresets.activePresetId} aria-label={t("presetDelete")} />
                    </Tooltip>
                  </Popconfirm>
                </Space.Compact>
              </Form.Item>

              <Divider className="!my-3" />

              {/* 「整体拼接」组：连接符/前缀/后缀 定义各行如何组装成整段输出。
                  微提示用结构式一眼说明 prefix + 行.join(连接符) + suffix（结构即信息）。 */}
              <div className="!mb-2">
                <Text type="secondary" className="!block !text-xs !font-medium !tracking-wide">
                  {t("sectionAssembly")}
                </Text>
                <Text type="secondary" className="!block !font-mono" style={{ fontSize: 11, opacity: 0.55 }}>
                  {t("assemblyHint")}
                </Text>
              </div>

              {/* 转义清单挂 label tooltip：常显时是两行说明压着一行控件，而且
                  prefix/suffix 同样走 parseEscapeChars，此前只有连接符写了说明。 */}
              <Form.Item label={t("lineSeparator")} tooltip={tCommon("supportEscapeChars")}>
                <Input value={lineSeparator} onChange={(e) => { setLineSeparator(e.target.value); setActiveBuiltinKey(""); }} aria-label={t("lineSeparator")} />
              </Form.Item>

              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label={t("prefix")} tooltip={tCommon("supportEscapeChars")}>
                    <Input value={prefix} onChange={(e) => { setPrefix(e.target.value); setActiveBuiltinKey(""); }} aria-label={t("prefix")} allowClear />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t("suffix")} tooltip={tCommon("supportEscapeChars")}>
                    <Input value={suffix} onChange={(e) => { setSuffix(e.target.value); setActiveBuiltinKey(""); }} aria-label={t("suffix")} allowClear />
                  </Form.Item>
                </Col>
              </Row>

              <Divider className="!my-3" />

              {sectionLabel(t("sectionRows"))}
              <Form.Item
                label={
                  <Tooltip title={t("alignModeTooltip")}>
                    <span>{t("alignMode")}</span>
                  </Tooltip>
                }>
                <Segmented
                  block
                  value={alignMode}
                  onChange={(v) => setAlignMode(v as typeof alignMode)}
                  options={[
                    { label: t("alignPad"), value: "pad" },
                    { label: t("alignTruncate"), value: "truncate" },
                  ]}
                />
              </Form.Item>

              <Form.Item className="!mb-0">
                <Flex justify="space-between" align="center">
                  <Tooltip title={t("skipEmptyRowsTooltip")}>
                    <span>{t("skipEmptyRows")}</span>
                  </Tooltip>
                  <Switch size="small" checked={skipEmptyRows} onChange={setSkipEmptyRows} aria-label={t("skipEmptyRows")} />
                </Flex>
              </Form.Item>
            </Form>
          </PageCard>
        </Col>
      </Row>

      {/* 输出：随输入实时更新。空结果按成因给出不同引导 */}
      <div className="!mt-4">
        {result ? (
          <div className="editorial-rise">
            <ResultCard content={result} stats={resultStats} onCopy={() => copyToClipboard(result)} onExport={() => downloadFile(result, "joined_text.txt")} />
          </div>
        ) : (
          <PageCard title={tCommon("result")} style={{ borderTop: `2px solid ${token.colorPrimary}` }}>
            <Flex vertical align="center" justify="center" gap={12} className="!py-10 !text-center">
              <MergeCellsOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />
              {!hasContent ? (
                <>
                  <div>
                    <Text className="!block !text-base">{t("emptyTitle")}</Text>
                    <Text type="secondary" className="!text-sm">
                      {t("emptyHint")}
                    </Text>
                  </div>
                  <Button icon={<ExperimentOutlined />} onClick={loadExample}>
                    {t("loadExample")}
                  </Button>
                </>
              ) : (
                <Text type="secondary" className="!text-sm">
                  {template ? t("emptyResult") : t("templateEmptyHint")}
                </Text>
              )}
            </Flex>
          </PageCard>
        )}
      </div>

      <Modal title={t("presetSaveAs")} open={presetModalOpen} onOk={handleSavePreset} onCancel={() => setPresetModalOpen(false)} destroyOnHidden>
        <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleSavePreset} autoFocus />
      </Modal>
    </>
  );
};

export default TextJoiner;
