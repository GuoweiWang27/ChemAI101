import { MoleculeStructure } from '../../../types';

/** 双语文案（3D 原子讲解用） */
export interface BilingualText {
  zh: string;
  en: string;
}

/** 单个原子的 AI 预生成讲解：role 一句话角色，detail 2–3 句展开 */
export interface AtomInsight {
  role: BilingualText;
  detail: BilingualText;
}

/** 策展反应条目。reviewed 字面量 true 是类型级门禁：
 *  只有任课老师签字后的条目才允许出现在正式章节数据文件里。 */
export interface CuratedReaction {
  id: string;               // 短 slug：^[a-z0-9-]{1,64}$，全局唯一
  chapter: string;          // 如 "必修1·第二章 海水中的重要元素"
  title: string;            // 如 "钠与水反应"
  reactants: string;
  conditions: string;
  equation: string;         // 配平好的方程式
  products: string[];
  mechanismSteps: string[]; // 2–5 步
  productStructure: MoleculeStructure | null; // 允许缺失（设计 §7）
  /** 演示模式联动：与 mechanismSteps 平行的原子 id 组（引用 productStructure.atoms.id）。
   *  需要化学判断，逐条人工标注；缺省步不高亮。 */
  stepAtomIds?: number[][];
  /** 原子级讲解（离线生成、签核后入库）。键为 productStructure.atoms.id 的十进制字符串
   *  （JSON 键只能为字符串），与 stepAtomIds 同一引用体系。缺省原子走元素静态卡降级。 */
  atomInsights?: Record<string, AtomInsight>;
  /** 全程反应动画数据（精选反应）。reactants 为反应物结构片段（局部坐标）与场景摆位；
   *  atomMap 描述反应物原子 → 产物原子 id 的迁移，未映射的反应物原子按副产物淡出。 */
  reactionFlow?: {
    reactants: Array<{
      label: string;
      structure: MoleculeStructure;
      position: [number, number, number];
    }>;
    atomMap: Array<{ reactant: number; atom: number; to: number }>;
  };
  smiles?: string;
  reviewed: true;
}
