import React, { createContext, useState, useContext, ReactNode } from 'react';

export type Language = 'en' | 'zh';

type Translations = {
  [key in Language]: {
    [key: string]: string | string[] | any;
  };
};

const translations: Translations = {
  en: {
    appTitle: "ChemAI Pro",
    navReaction: "Reaction Lab",
    navBuilder: "Structure Builder",
    reactionSetup: "Reaction Setup",
    reactants: "Reactants",
    conditions: "Conditions (Optional)",
    placeholderReactants: "e.g. H2 + O2, Ethanol + Acetic Acid",
    placeholderConditions: "Temperature, Catalyst...",
    predictBtn: "Predict Reaction",
    analyzingBtn: "Analyzing...",
    mechanism: "Reaction Mechanism",
    step: "Step",
    reactionResult: "Reaction Result",
    productsIdentified: "Products Identified",
    geometry: "Geometry (VSEPR)",
    productStructure: "3D Product Structure",
    interactive: "Interactive",
    readyToSimulate: "Ready to Simulate",
    enterReactants: "Enter reactants to visualize the chemical process",
    tools: "Tools",
    elements: "Elements",
    instructionsTitle: "Instructions",
    instructions: [
      "Select an element and click on canvas to add atoms.",
      "Select \"Connect Bond\" tool, then click two atoms to link them. Click again to change bond order.",
      "Click \"Analyze Structure\" to get the IUPAC name."
    ],
    canvasStats: "Canvas: {{atoms}} atoms, {{bonds}} bonds",
    analyzeBtn: "Analyze Structure",
    ruleLogic: "Rule Logic",
    buildMoleculeInfo: "Build a molecule and click analyze to see IUPAC naming.",
    interactive3D: "Interactive 3D View",
    failedToAnalyze: "Failed to analyze reaction. Please check your API key and try again.",
    failedToName: "Could not name molecule. Try again.",
    toolsTooltip: {
      move: "Select/Move",
      bond: "Connect Bond",
      delete: "Delete",
      clear: "Clear All"
    },
    commonNameLabel: "Common Name",
    systematicNameLabel: "Systematic Name"
  },
  zh: {
    appTitle: "化学AI专家",
    navReaction: "反应实验室",
    navBuilder: "结构构建器",
    reactionSetup: "反应设置",
    reactants: "反应物",
    conditions: "反应条件 (可选)",
    placeholderReactants: "例如：H2 + O2, 乙醇 + 乙酸",
    placeholderConditions: "温度, 催化剂...",
    predictBtn: "预测反应",
    analyzingBtn: "分析中...",
    mechanism: "反应机理",
    step: "步骤",
    reactionResult: "反应结果",
    productsIdentified: "生成的产物",
    geometry: "分子几何构型 (VSEPR)",
    productStructure: "3D 产物结构",
    interactive: "可交互",
    readyToSimulate: "准备模拟",
    enterReactants: "输入反应物以可视化化学过程",
    tools: "工具栏",
    elements: "元素",
    instructionsTitle: "使用说明",
    instructions: [
      "选择元素并在画布上点击以添加原子。",
      "选择“连接键”工具，然后点击两个原子进行连接。再次点击可更改键级。",
      "点击“分析结构”以获取 IUPAC 命名。"
    ],
    canvasStats: "画布: {{atoms}} 原子, {{bonds}} 键",
    analyzeBtn: "分析结构",
    ruleLogic: "命名规则",
    buildMoleculeInfo: "构建分子并点击分析以查看 IUPAC 命名。",
    interactive3D: "交互式 3D 视图",
    failedToAnalyze: "分析反应失败。请检查您的 API 密钥并重试。",
    failedToName: "无法命名分子。请重试。",
    toolsTooltip: {
      move: "选择/移动",
      bond: "连接键",
      delete: "删除",
      clear: "清空全部"
    },
    commonNameLabel: "俗名",
    systematicNameLabel: "系统命名"
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh'); // Default to Chinese as requested implies a Chinese context

  const t = (key: string, params?: Record<string, string | number>) => {
    let value = translations[language][key];
    
    // Handle nested keys (simple implementation for toolsTooltip)
    if (!value && key.includes('.')) {
        const [parent, child] = key.split('.');
        value = translations[language][parent]?.[child];
    }

    if (value === undefined) return key;

    if (typeof value === 'string' && params) {
      Object.entries(params).forEach(([k, v]) => {
        value = (value as string).replace(`{{${k}}}`, String(v));
      });
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
