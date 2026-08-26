import React, { createContext, useState, useContext, ReactNode } from 'react';

export type Language = 'en' | 'zh';

type Translations = {
  [key in Language]: {
    [key: string]: string | string[] | any;
  };
};

const translations: Translations = {
  en: {
    appTitle: "ChemAI101",
    navReaction: "Reaction Lab",
    navBuilder: "Structure Builder",
    reactionSetup: "Reaction Setup",
    labModePhenomenon: "Phenomenon",
    labModePro: "Expert",
    phenomenonLabel: "Describe what you saw or want to explore",
    phenomenonPlaceholder: "e.g. I want to see the principle behind elephant toothpaste",
    interpretBtn: "AI Interpret",
    interpretingBtn: "Interpreting...",
    pickCandidate: "AI thinks it could be one of these — pick one to generate:",
    confirmCandidate: "This one, generate",
    noneMatchBtn: "None of these, rephrase",
    interpretEmpty: "AI couldn't match a classroom demo to that. Try rephrasing.",
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
    generatingTitle: "Generating 3D structure…",
    generatingHint: "AI is analyzing the reaction, deriving the mechanism and building the molecular model. This usually takes a few seconds.",
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
    resetViewBtn: "Reset view",
    insightFallbackHint: "AI insight for this atom is coming soon.",
    closeBtn: "Close",
    flowPlayBtn: "Full reaction",
    flowReplayBtn: "Replay",
    flowBackBtn: "Back to steps",
    flowExitPreviewBtn: "Exit animation",
    failedToAnalyze: "Failed to analyze reaction. Please check your API key and try again.",
    failedToName: "Could not name molecule. Try again.",
    toolsTooltip: {
      move: "Select/Move",
      bond: "Connect Bond",
      delete: "Delete",
      clear: "Clear All"
    },
    commonNameLabel: "Common Name",
    systematicNameLabel: "Systematic Name",
    navLibrary: "Molecule Library",
    libTabAi: "AI Identify",
    libTabName: "Search by Name",
    describeMoleculeLabel: "Describe the molecule (look, smell, properties, uses…)",
    describeMoleculePlaceholder: "e.g. a colorless gas with a pungent smell that bleaches dyestuffs",
    identifyMolBtn: "AI Identify",
    identifyingMolBtn: "Identifying...",
    pickMoleculeHint: "AI thinks it could be one of these — pick one to verify in PubChem:",
    confirmMoleculeBtn: "This one, look it up",
    libraryIntro: "Search any compound by name to load its official PubChem 3D structure.",
    searchPlaceholder: "e.g. aspirin, caffeine, glucose",
    searchBtn: "Load Structure",
    searchingBtn: "Loading...",
    formulaLabel: "Molecular Formula",
    weightLabel: "Molecular Weight",
    gPerMol: "g/mol",
    iupacLabel: "IUPAC Name",
    sourceBadge: "PubChem Data",
    structure3dBadge: "3D Structure",
    structure2dBadge: "2D Structure",
    notFoundMsg: "No compound found with that name. Try the English name.",
    dataBusyMsg: "The chemistry database is busy. Please try again shortly.",
    networkErrorMsg: "Could not load compound data.",
    verifyVerified: "Passed deterministic chemistry checks",
    verifyWarning: "Failed some chemistry checks — treat as reference only",
    verifyUnknown: "Structure not automatically verifiable",
    navLibraryCurated: "Textbook Reactions",
    curatedEmpty: "The first batch is being reviewed by our chemistry teacher. Coming soon.",
    backBtn: "Back",
    demoBtn: "Present",
    qrBtn: "QR Code",
    linkCopied: "Link copied!",
    mechanismLabel: "Mechanism Steps",
    conditionsLabel: "Conditions",
    noStructureMsg: "No 3D structure available for this reaction.",
    curatedIntro: "Classic reactions from the PEP high-school textbook, curated with our chemistry teacher. Click any card to open its lesson view.",
    curatedCount: "{{count}} reactions online",
    navHome: "Home",
    homeTaglineMain: "Speak a phenomenon, ",
    homeTaglineAccent: "see the reaction",
    homeSubtitle: "Your AI chemistry lab partner",
    homeCapabilities: "Phenomenon interpretation · Reaction prediction · Molecule building · Structure lookup",
    homeCardCuratedDesc: "PEP textbook classics — first choice for classroom demos",
    homeCardLabDesc: "Type reactants, get AI products + mechanism + 3D structure",
    homeCardBuilderDesc: "Build molecules by hand, get IUPAC names",
    homeCardPubchemDesc: "Official PubChem database — search a name, see it in 3D",
    homeReadyReactions: "{{count}} classroom-ready reactions",
    homeReviewBadge: "Teacher review in progress",
    homeLabBadge: "AI prediction · structure checks",
    homeBuilderBadge: "Live formula · official naming",
    homePubchemBadge: "PubChem data · Chinese names supported",
    homeStatsLine: "{{count}} chemistry explorations and counting",
    builderLiveFormula: "Current formula",
    builderTemplates: "Quick templates",
    officialMatch: "Database match",
    noMatchHint: "No PubChem match for this composition.",
    aiFallbackBtn: "AI naming (beta)",
    fragmentsWarning: "{{count}} disconnected fragments on canvas",
    undoTitle: "Undo",
    chainHint: "Pick an element and keep clicking — new atoms auto-bond to the previous one."
  },
  zh: {
    appTitle: "ChemAI101",
    navReaction: "反应实验室",
    navBuilder: "结构构建器",
    reactionSetup: "反应设置",
    labModePhenomenon: "现象模式",
    labModePro: "专业模式",
    phenomenonLabel: "描述你看到或想探索的现象",
    phenomenonPlaceholder: "例如：我想看一下大象牙膏的反应原理",
    interpretBtn: "AI 解读现象",
    interpretingBtn: "解读中…",
    pickCandidate: "AI 认为可能是这些反应，选一个开始生成：",
    confirmCandidate: "就这个，生成",
    noneMatchBtn: "都不对，换个说法",
    interpretEmpty: "AI 没能认出对应的课堂演示反应，换个说法试试。",
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
    generatingTitle: "3D 图像正在生成…",
    generatingHint: "AI 正在分析反应、推导机理并搭建分子模型，通常需要几秒钟，请稍候。",
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
    resetViewBtn: "重置视角",
    insightFallbackHint: "这个原子的 AI 讲解即将上线。",
    closeBtn: "关闭",
    flowPlayBtn: "全程动画",
    flowReplayBtn: "重播",
    flowBackBtn: "返回步骤",
    flowExitPreviewBtn: "退出动画",
    failedToAnalyze: "分析反应失败。请检查您的 API 密钥并重试。",
    failedToName: "无法命名分子。请重试。",
    toolsTooltip: {
      move: "选择/移动",
      bond: "连接键",
      delete: "删除",
      clear: "清空全部"
    },
    commonNameLabel: "俗名",
    systematicNameLabel: "系统命名",
    navLibrary: "分子库",
    libTabAi: "AI 认分子",
    libTabName: "按名字搜索",
    describeMoleculeLabel: "描述这个分子（外观、气味、性质、用途…）",
    describeMoleculePlaceholder: "例如：一种无色有刺激性气味的气体，能使品红溶液褪色",
    identifyMolBtn: "AI 认分子",
    identifyingMolBtn: "识别中…",
    pickMoleculeHint: "AI 认为可能是这些分子，选一个去数据库查证：",
    confirmMoleculeBtn: "就是它，查库",
    libraryIntro: "按名称检索任意化合物，加载 PubChem 官方 3D 结构。",
    searchPlaceholder: "支持中文／英文，如：阿司匹林、aspirin",
    searchBtn: "加载结构",
    searchingBtn: "加载中...",
    formulaLabel: "分子式",
    weightLabel: "分子量",
    gPerMol: "g/mol",
    iupacLabel: "IUPAC 命名",
    sourceBadge: "PubChem 数据",
    structure3dBadge: "3D 结构",
    structure2dBadge: "2D 结构",
    notFoundMsg: "没有找到该化合物，换个名字或试试英文名。",
    dataBusyMsg: "化学数据库正忙，请稍后再试。",
    networkErrorMsg: "无法加载化合物数据。",
    verifyVerified: "已通过确定性化学校验",
    verifyWarning: "未完全通过化学校验，仅供参考",
    verifyUnknown: "结构暂无法自动校验",
    navLibraryCurated: "教材反应库",
    curatedEmpty: "首批内容正在由化学老师审核签核中，敬请期待。",
    backBtn: "返回",
    demoBtn: "演示模式",
    qrBtn: "扫码学习",
    linkCopied: "链接已复制！",
    mechanismLabel: "机理步骤",
    conditionsLabel: "反应条件",
    noStructureMsg: "该反应暂无 3D 结构数据。",
    curatedIntro: "按人教版教材章节整理的典型反应，与化学老师共同校订。点击卡片进入教学视图。",
    curatedCount: "已上线 {{count}} 个反应",
    navHome: "首页",
    homeTaglineMain: "说出现象，",
    homeTaglineAccent: "看懂反应",
    homeSubtitle: "你的 AI 化学实验搭档",
    homeCapabilities: "现象解读 · 反应预测 · 分子搭建 · 结构检索",
    homeCardCuratedDesc: "人教版教材经典反应 · 课堂演示首选",
    homeCardLabDesc: "输入反应物，AI 预测产物＋机理＋3D 结构",
    homeCardBuilderDesc: "动手搭建分子，获取 IUPAC 命名",
    homeCardPubchemDesc: "PubChem 官方数据库，搜名字出 3D 结构",
    homeReadyReactions: "{{count}} 个课堂就绪反应",
    homeReviewBadge: "老师签批进行中",
    homeLabBadge: "AI 预测 · 结构校验",
    homeBuilderBadge: "实时分子式 · 官方命名",
    homePubchemBadge: "PubChem 数据 · 支持中文名",
    homeStatsLine: "已累计 {{count}} 次化学探索",
    builderLiveFormula: "当前分子式",
    builderTemplates: "常用模板",
    officialMatch: "数据库匹配",
    noMatchHint: "PubChem 未收录该组成。",
    aiFallbackBtn: "AI 命名（实验性）",
    fragmentsWarning: "画布上有 {{count}} 个独立碎片",
    undoTitle: "撤销",
    chainHint: "提示：选中元素后连续点击，新原子会自动与上一个成键。"
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
