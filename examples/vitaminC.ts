/**
 * 维生素C分子量计算示例
 * 维生素C (Ascorbic Acid)
 * SMILES: C(C1C(C(=C(O1)O)O)=O)O
 * 分子式: C6H8O6
 */

import { calculateMolecularWeight, getAtomComposition, formatMolecularWeight } from '../utils/molecularWeight';

// 维生素C的SMILES字符串
const vitaminCSMILES = 'C(C1C(C(=C(O1)O)O)=O)O';

// 计算分子量
const molecularWeight = calculateMolecularWeight(vitaminCSMILES);

// 获取原子组成
const composition = getAtomComposition(vitaminCSMILES);

// 输出结果
console.log('=== 维生素C分子量计算 ===');
console.log(`SMILES: ${vitaminCSMILES}`);
console.log(`分子式: C${composition.C || 0}H${composition.H || 0}O${composition.O || 0}`);
console.log(`原子组成:`, composition);
console.log(`分子量: ${formatMolecularWeight(molecularWeight)} g/mol`);
console.log(`分子量（精确值）: ${molecularWeight} g/mol`);

// 导出结果
export const vitaminCResult = {
  smiles: vitaminCSMILES,
  formula: `C${composition.C || 0}H${composition.H || 0}O${composition.O || 0}`,
  composition,
  molecularWeight,
  formattedWeight: formatMolecularWeight(molecularWeight)
};



