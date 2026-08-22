/**
 * 分子量计算工具
 * 用于计算基于SMILES字符串的分子量
 */

// 原子量数据（单位：g/mol，基于IUPAC 2019标准）
const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008,
  He: 4.003,
  Li: 6.94,
  Be: 9.012,
  B: 10.81,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  Ne: 20.180,
  Na: 22.990,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.085,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  Ar: 39.95,
  K: 39.098,
  Ca: 40.078,
  Br: 79.904,
  I: 126.90,
};

/**
 * 解析SMILES字符串并计算分子量
 * @param smiles SMILES字符串
 * @returns 分子量（g/mol）
 */
export function calculateMolecularWeight(smiles: string): number {
  // 移除SMILES中的括号、数字等，只保留原子符号
  // 这是一个简化版本，适用于大多数常见分子
  
  const atomCounts: Record<string, number> = {};
  let i = 0;
  
  while (i < smiles.length) {
    const char = smiles[i];
    
    // 跳过括号、等号、数字等
    if (char === '(' || char === ')' || char === '=' || char === '[' || char === ']' || 
        char === '1' || char === '2' || char === '3' || char === '4' || char === '5' ||
        char === '6' || char === '7' || char === '8' || char === '9' || char === '0' ||
        char === '+' || char === '-' || char === '#') {
      i++;
      continue;
    }
    
    // 检查是否是原子符号
    // 单字母元素（如 C, N, O, H, F, P, S, I）
    if (char.match(/[A-Z]/)) {
      let element = char;
      
      // 检查下一个字符是否是小写字母（双字母元素，如 Cl, Br, Na）
      if (i + 1 < smiles.length && smiles[i + 1].match(/[a-z]/)) {
        element = char + smiles[i + 1];
        i += 2;
      } else {
        i++;
      }
      
      // 增加原子计数
      if (ATOMIC_WEIGHTS[element]) {
        atomCounts[element] = (atomCounts[element] || 0) + 1;
      }
    } else {
      i++;
    }
  }
  
  // 计算总分子量
  let totalWeight = 0;
  for (const [element, count] of Object.entries(atomCounts)) {
    totalWeight += ATOMIC_WEIGHTS[element] * count;
  }
  
  return totalWeight;
}

/**
 * 获取原子组成信息
 * @param smiles SMILES字符串
 * @returns 原子组成对象
 */
export function getAtomComposition(smiles: string): Record<string, number> {
  const atomCounts: Record<string, number> = {};
  let i = 0;
  
  while (i < smiles.length) {
    const char = smiles[i];
    
    // 跳过括号、等号、数字等
    if (char === '(' || char === ')' || char === '=' || char === '[' || char === ']' || 
        char === '1' || char === '2' || char === '3' || char === '4' || char === '5' ||
        char === '6' || char === '7' || char === '8' || char === '9' || char === '0' ||
        char === '+' || char === '-' || char === '#') {
      i++;
      continue;
    }
    
    // 检查是否是原子符号
    if (char.match(/[A-Z]/)) {
      let element = char;
      
      // 检查下一个字符是否是小写字母（双字母元素）
      if (i + 1 < smiles.length && smiles[i + 1].match(/[a-z]/)) {
        element = char + smiles[i + 1];
        i += 2;
      } else {
        i++;
      }
      
      // 增加原子计数
      if (ATOMIC_WEIGHTS[element]) {
        atomCounts[element] = (atomCounts[element] || 0) + 1;
      }
    } else {
      i++;
    }
  }
  
  return atomCounts;
}

/**
 * 格式化分子量结果
 * @param weight 分子量
 * @param decimals 小数位数
 * @returns 格式化后的字符串
 */
export function formatMolecularWeight(weight: number, decimals: number = 2): string {
  return weight.toFixed(decimals);
}



