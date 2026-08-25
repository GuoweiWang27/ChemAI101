import { MoleculeStructure } from '../../../types';

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
  smiles?: string;
  reviewed: true;
}
