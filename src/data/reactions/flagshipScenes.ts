import type {
  FlagshipCameraShot,
  FlagshipMacroKind,
  FlagshipTeachingMoment,
  ReactionAnimationEvidence,
  ReactionAnimationQualityLevel,
} from './schema';

export const FLAGSHIP_REACTION_IDS = [
  'na-h2o',
  's-o2',
  'nh3-hcl-smoke',
  'c2h4-br2',
  'cao-water-exothermic',
] as const;

export type FlagshipReactionId = (typeof FLAGSHIP_REACTION_IDS)[number];

export const FLAGSHIP_MICRO_KINDS = [
  'reactant-distribution',
  'interface-contact',
  'electron-transfer',
  'hydrogen-recombination',
  'ion-dispersion',
  'heating-condition',
  'oxygen-bond-change',
  'so2-diffusion',
  'gas-distribution',
  'diffusion',
  'proton-transfer',
  'ionic-particle-aggregation',
  'alkene-and-bromine',
  'double-bond-approach',
  'pi-bond-rewire',
  'dibromo-formation',
  'bromine-consumption',
  'crystal-and-water',
  'surface-hydration',
  'hydroxide-reorganization',
  'energy-release',
  'product-structure',
] as const;

export type FlagshipMicroKind = (typeof FLAGSHIP_MICRO_KINDS)[number];

export interface FlagshipStageBlueprint {
  id: string;
  labelZh: string;
  labelEn: string;
  statusZh: string;
  statusEn: string;
  equationFocus: 'reactants' | 'change' | 'products' | 'observation';
}

export interface FlagshipBlueprint {
  reactionId: FlagshipReactionId;
  qualityLevel: ReactionAnimationQualityLevel;
  stageLabels: FlagshipStageBlueprint[];
  macroKinds: FlagshipMacroKind[];
  microKinds: FlagshipMicroKind[];
  teachingMoments: Omit<FlagshipTeachingMoment, 'stageId' | 'at'>[];
  teachingStageIds?: string[];
  evidence: ReactionAnimationEvidence[];
  cameraShots?: FlagshipCameraShot[];
}

const text = (zh: string, en: string) => ({ zh, en });

const EVIDENCE = {
  'na-h2o': 'https://edu.rsc.org/experiments/reactivity-trends-of-the-alkali-metals/731.article',
  's-o2': 'https://edu.rsc.org/experiments/reacting-elements-with-oxygen/705.article',
  'nh3-hcl-smoke': 'https://edu.rsc.org/experiments/making-and-testing-ammonia/433.article',
  'c2h4-br2': 'https://openstax.org/books/organic-chemistry/pages/8-2-halogenation-of-alkenes-addition-of-x2',
  'cao-water-exothermic': 'https://edu.rsc.org/resources/cool-drinking-problem-based-practical-activities/4018033.article',
} satisfies Record<FlagshipReactionId, string>;

const evidence = (
  id: string,
  label: string,
  url: string,
  note?: string,
): ReactionAnimationEvidence => ({ id, label, url, ...(note ? { note } : {}) });

export const FLAGSHIP_BLUEPRINTS: Record<FlagshipReactionId, FlagshipBlueprint> = {
  'na-h2o': {
    reactionId: 'na-h2o',
    qualityLevel: 'L3',
    stageLabels: [
      {
        id: 'surface',
        labelZh: '初始观察',
        labelEn: 'Initial observation',
        statusZh: '钠浮在水面上，先观察反应物的状态与相对密度。',
        statusEn: 'Sodium floats at the surface; first observe the reactant states and relative density.',
        equationFocus: 'reactants',
      },
      {
        id: 'melt',
        labelZh: '接触放热',
        labelEn: 'Contact and heat',
        statusZh: '钠与水接触后放热，低熔点钠可熔成小球。',
        statusEn: 'Contact with water releases heat, and low-melting sodium may form a bead.',
        equationFocus: 'change',
      },
      {
        id: 'electron',
        labelZh: '电子转移',
        labelEn: 'Electron transfer',
        statusZh: '钠失去电子，水中的氢得到电子并开始形成氢气。',
        statusEn: 'Sodium loses electrons while hydrogen in water receives them and begins forming hydrogen gas.',
        equationFocus: 'change',
      },
      {
        id: 'hydrogen',
        labelZh: '氢气形成',
        labelEn: 'Hydrogen formation',
        statusZh: '氢原子重组为 H₂ 并从水面逸出；钠球的运动只作教材化示意。',
        statusEn: 'Hydrogen atoms recombine as H₂ and escape; the sodium bead motion is an educational abstraction.',
        equationFocus: 'products',
      },
      {
        id: 'ions',
        labelZh: '碱性溶液',
        labelEn: 'Alkaline solution',
        statusZh: 'Na⁺ 与 OH⁻ 留在溶液中，碱性可由指示剂现象辅助说明。',
        statusEn: 'Na⁺ and OH⁻ remain in solution; an indicator observation can support the alkaline-product explanation.',
        equationFocus: 'products',
      },
    ],
    macroKinds: ['metal-on-water', 'heat-rise', 'metal-on-water', 'metal-on-water', 'solution-color'],
    microKinds: ['reactant-distribution', 'interface-contact', 'electron-transfer', 'hydrogen-recombination', 'ion-dispersion'],
    teachingMoments: [
      {
        id: 'na-h2o-density-question',
        question: text('为什么钠浮在水面？', 'Why does sodium float on water?'),
        hint: text('先比较教材中钠和水的密度关系，再把它与画面中的水面位置对应起来。', 'Compare the textbook density relationship between sodium and water, then connect it to the surface position shown.'),
        expectedObservation: text('钠先停留在水面，而不是立即沉入水底；这是观察到的相对密度现象。', 'The sodium bead stays at the surface instead of sinking immediately; this is the observed relative-density phenomenon.'),
      },
      {
        id: 'na-h2o-gas-question',
        question: text('气泡来自哪个反应物？', 'Which reactant supplies the gas bubbles?'),
        hint: text('追踪水分子中的氢：电子转移后，氢原子重组为 H₂。', 'Trace the hydrogen in water: after electron transfer, hydrogen atoms recombine as H₂.'),
        expectedObservation: text('气泡对应生成的 H₂；氧则留在 OH⁻ 中，微观轨与宏观逸气同步。', 'The bubbles correspond to formed H₂; oxygen remains in OH⁻, linking the micro track to the visible gas.'),
      },
      {
        id: 'na-h2o-coefficient-question',
        question: text('方程式系数为什么是 2:2:2:1？', 'Why are the equation coefficients 2:2:2:1?'),
        hint: text('逐项核对 Na、O、H 的原子数，并注意两个水分子提供一个 H₂ 和两个 OH⁻。', 'Count Na, O and H on both sides; two water molecules provide one H₂ and two OH⁻ groups.'),
        expectedObservation: text('反应前后 Na、O、H 原子数相等，2Na + 2H₂O → 2NaOH + H₂ 才满足守恒。', 'Na, O and H counts match across the equation, so 2Na + 2H₂O → 2NaOH + H₂ satisfies conservation.'),
      },
    ],
    teachingStageIds: ['surface', 'hydrogen', 'ions'],
    evidence: [
      evidence('na-h2o-rsc', 'RSC alkali-metal reactivity demonstration', EVIDENCE['na-h2o'], '用于核对浮水面、熔化、放气与条件性燃烧等教材现象。'),
    ],
    cameraShots: [
      { stageId: 'surface', target: 'split', zoom: 1 },
      { stageId: 'electron', target: 'micro', zoom: 1.12 },
      { stageId: 'ions', target: 'split', zoom: 1.04 },
    ],
  },
  's-o2': {
    reactionId: 's-o2',
    qualityLevel: 'L2',
    stageLabels: [
      {
        id: 'sulfur-heating',
        labelZh: '硫受热',
        labelEn: 'Sulfur is heated',
        statusZh: '加热提供反应条件，硫与氧气仍处于反应前状态。',
        statusEn: 'Heating supplies a reaction condition while sulfur and oxygen remain reactants.',
        equationFocus: 'reactants',
      },
      {
        id: 'sulfur-ignition',
        labelZh: '点燃',
        labelEn: 'Ignition',
        statusZh: '点燃后出现蓝色至蓝紫色火焰；颜色是宏观观察，不是光谱测量。',
        statusEn: 'Ignition produces a blue to blue-violet flame; the color is a macroscopic observation, not a spectrum measurement.',
        equationFocus: 'observation',
      },
      {
        id: 'sulfur-oxygen-bonding',
        labelZh: '硫氧键形成',
        labelEn: 'Sulfur–oxygen bonding',
        statusZh: '氧分子参与重排，硫氧键形成并指向 SO₂ 的生成。',
        statusEn: 'Oxygen molecules rearrange as sulfur–oxygen bonds form toward SO₂ generation.',
        equationFocus: 'change',
      },
      {
        id: 'sulfur-dioxide-diffusion',
        labelZh: '二氧化硫扩散',
        labelEn: 'Sulfur dioxide diffuses',
        statusZh: 'SO₂ 分子扩散，刺激性气体只作为教材现象标签呈现。',
        statusEn: 'SO₂ molecules diffuse; the irritating-gas property is shown only as a textbook phenomenon label.',
        equationFocus: 'products',
      },
    ],
    macroKinds: ['heat-rise', 'flame', 'flame', 'smoke'],
    microKinds: ['reactant-distribution', 'heating-condition', 'oxygen-bond-change', 'so2-diffusion'],
    teachingMoments: [
      {
        id: 's-o2-condition-question',
        question: text('加热是反应物还是反应条件？', 'Is heating a reactant or a reaction condition?'),
        hint: text('检查方程式两侧的物质，再看点燃或加热写在反应条件位置。', 'Check the substances on both sides of the equation, then note that ignition or heating belongs above the reaction arrow.'),
        expectedObservation: text('加热不被计入物质计量；它提供启动反应所需的条件。', 'Heating is not counted as a stoichiometric substance; it supplies the condition needed to start the reaction.'),
      },
      {
        id: 's-o2-product-question',
        question: text('生成物为什么写作 SO₂？', 'Why is the product written as SO₂?'),
        hint: text('把一个硫原子与一个氧分子中的两个氧原子对应起来，检查化学式与守恒。', 'Match one sulfur atom with the two oxygen atoms from one oxygen molecule, then check the formula against conservation.'),
        expectedObservation: text('一个 SO₂ 分子含 1 个 S 和 2 个 O，符合 S + O₂ → SO₂。', 'One SO₂ molecule contains one S and two O atoms, matching S + O₂ → SO₂.'),
      },
      {
        id: 's-o2-flame-question',
        question: text('蓝色火焰属于宏观证据还是微观解释？', 'Is the blue flame macroscopic evidence or a microscopic explanation?'),
        hint: text('区分眼睛观察到的颜色与粒子/成键模型：前者是现象，后者解释现象。', 'Separate the color seen by the eye from the particle and bonding model: the first is evidence, the second explains it.'),
        expectedObservation: text('蓝色火焰是宏观现象；硫氧键形成和 SO₂ 生成是微观解释。', 'The blue flame is macroscopic evidence; sulfur–oxygen bonding and SO₂ formation are the microscopic explanation.'),
      },
    ],
    teachingStageIds: ['sulfur-heating', 'sulfur-oxygen-bonding', 'sulfur-ignition'],
    evidence: [
      evidence('s-o2-rsc', 'RSC reactions with oxygen demonstration', EVIDENCE['s-o2'], '用于核对硫在氧气中燃烧的火焰颜色与 SO₂ 生成描述。'),
      evidence('s-o2-libretexts', 'Chemistry LibreTexts sulfur chemistry reference', 'https://chem.libretexts.org/Bookshelves/Inorganic_Chemistry/Inorganic_Chemistry_%28LibreTexts%29/08%253A_Chemistry_of_the_Main_Group_Elements/8.11%253A_The_Oxygen_Family_%28The_Chalcogens%29/8.11.03%253A_Chemistry_of_Sulfur_%28Z16%29', '直接核对 S + O₂ → SO₂ 与蓝色火焰描述。'),
    ],
    cameraShots: [
      { stageId: 'sulfur-heating', target: 'macro', zoom: 1.04 },
      { stageId: 'sulfur-oxygen-bonding', target: 'micro', zoom: 1.12 },
    ],
  },
  'nh3-hcl-smoke': {
    reactionId: 'nh3-hcl-smoke',
    qualityLevel: 'L2',
    stageLabels: [
      {
        id: 'gas-distribution',
        labelZh: '两种气体分布',
        labelEn: 'Two gases distributed',
        statusZh: '氨分子和氯化氢分子从两侧分布，初始都不可见。',
        statusEn: 'Ammonia and hydrogen chloride molecules begin on opposite sides and are initially invisible.',
        equationFocus: 'reactants',
      },
      {
        id: 'diffusion-meeting',
        labelZh: '扩散相遇',
        labelEn: 'Diffusion and encounter',
        statusZh: '两种气体扩散并在中间区域相遇；白烟位置不作定量扩散结论。',
        statusEn: 'The gases diffuse and meet in the middle; the smoke position is not a quantitative diffusion result.',
        equationFocus: 'observation',
      },
      {
        id: 'proton-transfer',
        labelZh: '质子转移',
        labelEn: 'Proton transfer',
        statusZh: '氨接受质子形成 NH₄⁺，氯化氢对应形成 Cl⁻。',
        statusEn: 'Ammonia accepts a proton to form NH₄⁺ while hydrogen chloride gives Cl⁻.',
        equationFocus: 'change',
      },
      {
        id: 'ammonium-chloride-particles',
        labelZh: '氯化铵微粒聚集',
        labelEn: 'Ammonium chloride particles gather',
        statusZh: 'NH₄⁺ 与 Cl⁻ 形成氯化铵微小晶粒，对应可见白烟。',
        statusEn: 'NH₄⁺ and Cl⁻ form tiny ammonium chloride particles corresponding to visible white smoke.',
        equationFocus: 'products',
      },
    ],
    macroKinds: ['smoke', 'smoke', 'smoke', 'smoke'],
    microKinds: ['gas-distribution', 'diffusion', 'proton-transfer', 'ionic-particle-aggregation'],
    teachingMoments: [
      {
        id: 'nh3-hcl-smoke-state-question',
        question: text('白烟是气体还是固体小颗粒？', 'Is the white smoke a gas or tiny solid particles?'),
        hint: text('观察白烟的可见性，再将其与 NH₄Cl 微小晶粒的生成对应。', 'Use the visibility of the smoke and connect it to the formation of tiny NH₄Cl particles.'),
        expectedObservation: text('白烟是悬浮在空气中的氯化铵微小固体颗粒，不是新的有色气体。', 'The smoke is tiny solid ammonium chloride particles suspended in air, not a new colored gas.'),
      },
      {
        id: 'nh3-hcl-smoke-visible-question',
        question: text('为什么两种无色气体会产生可见现象？', 'Why can two colorless gases produce a visible phenomenon?'),
        hint: text('把宏观白烟与微观相遇后的离子组合联系起来，而不是把气体本身涂成白色。', 'Connect the macroscopic smoke to ionic assembly after the gases meet rather than coloring the gases themselves.'),
        expectedObservation: text('反应生成的固体微粒散射光，形成可见白烟；反应物的无色不矛盾。', 'New solid particles scatter light and make white smoke visible; the colorless reactants are not contradictory.'),
      },
      {
        id: 'nh3-hcl-smoke-charge-question',
        question: text('微观图中电荷如何守恒？', 'How is charge conserved in the microscopic picture?'),
        hint: text('跟踪 NH₃ 接受 H⁺ 形成 NH₄⁺，同时 HCl 留下 Cl⁻，再相加检查总电荷。', 'Track NH₃ accepting H⁺ to form NH₄⁺ while HCl leaves Cl⁻, then add the charges.'),
        expectedObservation: text('NH₄⁺ 的 +1 与 Cl⁻ 的 −1 相抵，氯化铵整体电中性。', 'The +1 charge of NH₄⁺ balances the −1 charge of Cl⁻, leaving neutral ammonium chloride overall.'),
      },
    ],
    teachingStageIds: ['ammonium-chloride-particles', 'diffusion-meeting', 'proton-transfer'],
    evidence: [
      evidence('nh3-hcl-smoke-rsc', 'RSC ammonia preparation and testing', EVIDENCE['nh3-hcl-smoke'], '用于核对氨与氯化氢相遇形成白烟的现象边界。'),
    ],
    cameraShots: [
      { stageId: 'diffusion-meeting', target: 'split', zoom: 1.06 },
      { stageId: 'proton-transfer', target: 'micro', zoom: 1.14 },
    ],
  },
  'c2h4-br2': {
    reactionId: 'c2h4-br2',
    qualityLevel: 'L2',
    stageLabels: [
      {
        id: 'reactant-display',
        labelZh: '反应物展示',
        labelEn: 'Reactants displayed',
        statusZh: '乙烯双键与 Br₂ 分子清晰展示；本场景采用非水惰性介质模型。',
        statusEn: 'The ethene double bond and Br₂ are shown clearly; this scene models a non-aqueous inert medium.',
        equationFocus: 'reactants',
      },
      {
        id: 'double-bond-approach',
        labelZh: '双键区域接近',
        labelEn: 'Double-bond region approaches',
        statusZh: '乙烯双键区域与溴分子接近，溴的红棕色仍可观察。',
        statusEn: 'The ethene double-bond region approaches Br₂ while the bromine red-brown color remains observable.',
        equationFocus: 'change',
      },
      {
        id: 'bond-rearrangement',
        labelZh: '键发生变化',
        labelEn: 'Bonds change',
        statusZh: 'C=C 的 π 键与 Br—Br 键发生变化，两个碳溴键开始形成。',
        statusEn: 'The C=C π bond and Br—Br bond change as two C—Br bonds begin to form.',
        equationFocus: 'change',
      },
      {
        id: 'addition-product',
        labelZh: '加成产物形成',
        labelEn: 'Addition product forms',
        statusZh: '两个 Br 原子分别加到两个碳原子上，形成 1,2-二溴乙烷。',
        statusEn: 'One Br atom adds to each carbon, forming 1,2-dibromoethane.',
        equationFocus: 'products',
      },
      {
        id: 'bromine-color-loss',
        labelZh: '溴颜色褪去',
        labelEn: 'Bromine color fades',
        statusZh: '溴分子被消耗，红棕色向无色示意过渡。',
        statusEn: 'Br₂ is consumed and the red-brown color transitions toward a colorless illustration.',
        equationFocus: 'observation',
      },
    ],
    macroKinds: ['solution-color', 'solution-color', 'solution-color', 'solution-color', 'solution-color'],
    microKinds: ['alkene-and-bromine', 'double-bond-approach', 'pi-bond-rewire', 'dibromo-formation', 'bromine-consumption'],
    teachingMoments: [
      {
        id: 'c2h4-br2-fading-question',
        question: text('褪色能说明什么？', 'What can decolorization show?'),
        hint: text('把红棕色 Br₂ 的减少与反应物消耗联系起来，但不要把单一颜色现象夸大成完整结构证明。', 'Connect the decrease of red-brown Br₂ to reactant consumption, without treating one color change as complete structural proof.'),
        expectedObservation: text('在本模型条件下，褪色表示溴被反应消耗，可作为碳碳不饱和键反应的教材现象。', 'In this modeled condition, fading means bromine is consumed and serves as the textbook observation for reaction with a C–C unsaturation.'),
      },
      {
        id: 'c2h4-br2-region-question',
        question: text('乙烯分子中哪一部分发生变化？', 'Which part of the ethene molecule changes?'),
        hint: text('观察 C=C 的 π 键与 Br—Br 键，再看两个新的 C—Br 单键。', 'Inspect the C=C π bond and Br—Br bond, then look for the two new C—Br single bonds.'),
        expectedObservation: text('双键中的一个 π 键和 Br—Br 键发生变化，两个 Br 分别加到两个碳上。', 'One π bond of the double bond and the Br—Br bond change, with one Br added to each carbon.'),
      },
      {
        id: 'c2h4-br2-conservation-question',
        question: text('加成前后原子数是否改变？', 'Does the atom count change before and after addition?'),
        hint: text('逐个核对 C、H、Br 的数量；键型变化不等于原子凭空增加或消失。', 'Count C, H and Br on each side; a bond-type change does not create or destroy atoms.'),
        expectedObservation: text('原子总数不变，CH₂=CH₂ 与 Br₂ 的原子全部进入 CH₂Br—CH₂Br。', 'The total atom count is unchanged; all atoms from CH₂=CH₂ and Br₂ enter CH₂Br—CH₂Br.'),
      },
    ],
    teachingStageIds: ['bromine-color-loss', 'bond-rearrangement', 'addition-product'],
    evidence: [
      evidence('c2h4-br2-openstax', 'OpenStax alkene halogenation reference', EVIDENCE['c2h4-br2'], '模型为教材化非水加成模型；含水体系可能形成卤代醇。'),
      evidence('c2h4-br2-water-caveat', 'OpenStax halohydrin reference', 'https://openstax.org/books/organic-chemistry/pages/8-3-halohydrins-from-alkenes-addition-of-ho-x', '直接核对水存在时可能由水进攻溴鎓离子并形成卤代醇的条件边界。'),
    ],
    cameraShots: [
      { stageId: 'double-bond-approach', target: 'micro', zoom: 1.14 },
      { stageId: 'bromine-color-loss', target: 'macro', zoom: 1.08 },
    ],
  },
  'cao-water-exothermic': {
    reactionId: 'cao-water-exothermic',
    qualityLevel: 'L2',
    stageLabels: [
      {
        id: 'solid-water-separated',
        labelZh: '固体与水分开',
        labelEn: 'Solid and water separated',
        statusZh: 'CaO 固体与水分子分开显示，反应尚未开始。',
        statusEn: 'CaO solid and water molecules are shown separately before the reaction begins.',
        equationFocus: 'reactants',
      },
      {
        id: 'water-contact',
        labelZh: '水接触固体',
        labelEn: 'Water contacts the solid',
        statusZh: '水分子靠近 CaO 表面，离子环境开始重排。',
        statusEn: 'Water molecules approach the CaO surface as the ionic environment begins to rearrange.',
        equationFocus: 'change',
      },
      {
        id: 'hydroxide-formation',
        labelZh: '氢氧化物形成',
        labelEn: 'Hydroxide forms',
        statusZh: '来自 CaO 和水的原子重组为氢氧化钙结构示意。',
        statusEn: 'Atoms from CaO and water reorganize into a calcium hydroxide structure illustration.',
        equationFocus: 'change',
      },
      {
        id: 'heat-release',
        labelZh: '放热',
        labelEn: 'Heat release',
        statusZh: '能量释放通过温度上升提示表达，不虚构具体测量数值。',
        statusEn: 'Energy release is represented by a temperature-rise cue without inventing a measured value.',
        equationFocus: 'observation',
      },
      {
        id: 'slaked-lime-formation',
        labelZh: '熟石灰形成',
        labelEn: 'Slaked lime forms',
        statusZh: '产物为氢氧化钙，俗名熟石灰；宏观形态变化仅作教学示意。',
        statusEn: 'The product is calcium hydroxide, commonly called slaked lime; the macroscopic morphology is educational only.',
        equationFocus: 'products',
      },
    ],
    macroKinds: ['solid-hydration', 'solid-hydration', 'solid-hydration', 'heat-rise', 'solid-hydration'],
    microKinds: ['crystal-and-water', 'surface-hydration', 'hydroxide-reorganization', 'energy-release', 'product-structure'],
    teachingMoments: [
      {
        id: 'cao-water-energy-question',
        question: text('温度升高说明能量如何变化？', 'What does a temperature rise say about energy?'),
        hint: text('把温度上升作为体系向外释放能量的宏观线索，再回到成键与结构重组。', 'Treat the temperature rise as a macroscopic clue that the system releases energy, then connect it to bonding and reorganization.'),
        expectedObservation: text('体系向外放出热量，温度上升是放热过程的宏观表现；不等于给出具体热值。', 'The system releases heat and the temperature rises as a macroscopic sign of an exothermic process; it does not provide a numerical heat value.'),
      },
      {
        id: 'cao-water-reactant-question',
        question: text('水是反应物还是只起溶剂作用？', 'Is water a reactant or only a solvent?'),
        hint: text('检查方程式两侧的 H₂O 与产物中的 OH 基团，追踪水中原子去向。', 'Check H₂O on the reactant side and the OH groups in the product, tracing where water atoms go.'),
        expectedObservation: text('水参与原子重组并写在反应物一侧，是反应物而不只是溶剂。', 'Water participates in atomic reorganization and appears as a reactant, not merely as a solvent.'),
      },
      {
        id: 'cao-water-name-question',
        question: text('为什么产物俗名是熟石灰？', 'Why is the product commonly called slaked lime?'),
        hint: text('把生石灰 CaO 与水反应后的产物 Ca(OH)₂ 对照，区分化学式和俗名。', 'Compare quicklime CaO with its water product Ca(OH)₂, separating the formula from the common name.'),
        expectedObservation: text('CaO 是生石灰，和水反应生成 Ca(OH)₂，Ca(OH)₂ 的俗名是熟石灰。', 'CaO is quicklime; reacting it with water gives Ca(OH)₂, whose common name is slaked lime.'),
      },
    ],
    teachingStageIds: ['heat-release', 'hydroxide-formation', 'slaked-lime-formation'],
    evidence: [
      evidence('cao-water-rsc', 'RSC cool-drinking problem-based activity', EVIDENCE['cao-water-exothermic'], '用于核对氧化钙与水反应的放热现象；不将示意画面当作具体温度测量。'),
    ],
    cameraShots: [
      { stageId: 'water-contact', target: 'split', zoom: 1.06 },
      { stageId: 'heat-release', target: 'macro', zoom: 1.1 },
    ],
  },
};

export function getFlagshipBlueprint(reactionId: string): FlagshipBlueprint | undefined {
  return (FLAGSHIP_REACTION_IDS as readonly string[]).includes(reactionId)
    ? FLAGSHIP_BLUEPRINTS[reactionId as FlagshipReactionId]
    : undefined;
}
