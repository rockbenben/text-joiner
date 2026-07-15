"use client";
import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import type { JoinerPreset } from "./joinerConfig";

type Deps = {
  template: string;
  lineSeparator: string;
  prefix: string;
  suffix: string;
  setTemplate: (v: string) => void;
  setLineSeparator: (v: string) => void;
  setPrefix: (v: string) => void;
  setSuffix: (v: string) => void;
};

/** 命名自定义模板（模板 + 连接符 + 前缀 + 后缀四件套）的增删改查，薄包装
 *  usePresetCollection。编辑字段后不自动清 active（同 PromptPresetPicker），
 *  由「更新」按钮显式回存。 */
export const useJoinerPresets = (deps: Deps) => {
  const { items: presets, setItems: setPresets, activeId: activePresetId, setActiveId: setActivePresetId, add, remove, update } = usePresetCollection<JoinerPreset>("text-joiner-presets", "text-joiner-activePresetId");

  const saveAs = (name: string) => {
    add({ id: String(Date.now()), name, template: deps.template, lineSeparator: deps.lineSeparator, prefix: deps.prefix, suffix: deps.suffix });
  };

  const load = (id: string) => {
    if (!id) {
      setActivePresetId("");
      return;
    }
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    deps.setTemplate(p.template);
    deps.setLineSeparator(p.lineSeparator);
    deps.setPrefix(p.prefix);
    deps.setSuffix(p.suffix);
    setActivePresetId(id);
  };

  const updateActive = () => {
    if (!activePresetId) return;
    update(activePresetId, { template: deps.template, lineSeparator: deps.lineSeparator, prefix: deps.prefix, suffix: deps.suffix });
  };

  return { presets, setPresets, activePresetId, setActivePresetId, saveAs, load, updateActive, remove };
};
