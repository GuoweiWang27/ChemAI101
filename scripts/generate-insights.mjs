#!/usr/bin/env node
/**
 * 离线生成教材反应库的原子讲解（atomInsights）与步骤原子标注（stepAtomIds）。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/generate-insights.mjs --dry-run   # 只看计划
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/generate-insights.mjs             # 全量
 *   DEEPSEEK_API_KEY=sk-xxx node scripts/generate-insights.mjs --only=na-h2o
 *
 * 断点续接：逐条处理、逐条立即写回章节 JSON；已完整（有 atomInsights 且 stepAtomIds
 * 合格）的条目自动跳过，可随时中断重跑。失败条目记入 .gen-errors.json，不阻断整批。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'src/data/reactions');
const CHAPTER_FILES = [
  'mustate-1-02-na-cl.json',
  'mustate-1-03-fe.json',
  'mustate-2-05-sn.json',
  'mustate-2-06-energy.json',
  'mustate-2-07-organic.json',
];
const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-v4-flash';
const DELAY_MS = 800;
const RETRIES = 2;

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const onlySlug = onlyArg ? onlyArg.slice('--only='.length) : null;

if (!process.env.DEEPSEEK_API_KEY && !dryRun) {
  console.error('缺少环境变量 DEEPSEEK_API_KEY');
  process.exit(1);
}

// ---------- 校验器（与 data.test.ts 同规则） ----------
function validateEntry(entry) {
  const problems = [];
  const st = entry.productStructure;
  if (!st) return ['productStructure 缺失，无法标注'];
  const ids = new Set(st.atoms.map((a) => a.id));

  if (entry.atomInsights) {
    for (const [key, insight] of Object.entries(entry.atomInsights)) {
      if (!/^\d+$/.test(key)) problems.push(`非法键 ${key}`);
      else if (!ids.has(Number(key))) problems.push(`键 ${key} 不在结构原子中`);
      for (const text of [insight?.role, insight?.detail]) {
        if (!text || typeof text.zh !== 'string' || typeof text.en !== 'string' ||
            !text.zh.trim() || !text.en.trim()) {
          problems.push(`键 ${key} 双语字段不完整`);
          break;
        }
      }
    }
  }
  if (entry.stepAtomIds !== undefined) {
    if (!Array.isArray(entry.stepAtomIds) || entry.stepAtomIds.length !== entry.mechanismSteps.length) {
      problems.push('stepAtomIds 长度与 mechanismSteps 不平行');
    } else {
      for (const group of entry.stepAtomIds) {
        for (const id of group) if (!ids.has(id)) problems.push(`stepAtomIds 引用不存在原子 ${id}`);
      }
    }
  }
  return problems;
}

function isComplete(entry) {
  const st = entry.productStructure;
  if (!st) return true; // 无结构的条目无事可做
  if (!entry.atomInsights || Object.keys(entry.atomInsights).length === 0) return false;
  if (!Array.isArray(entry.stepAtomIds) || entry.stepAtomIds.length !== entry.mechanismSteps.length) return false;
  return validateEntry(entry).length === 0;
}

// ---------- DeepSeek 调用 ----------
function buildPrompt(entry) {
  const atoms = entry.productStructure.atoms.map(
    (a) => ({ id: a.id, element: a.element }),
  );
  const bonds = entry.productStructure.bonds.map(
    (b) => ({ source: b.source, target: b.target, order: b.order }),
  );
  return [
    `反应标题：${entry.title}（${entry.chapter}）`,
    `反应物：${entry.reactants}`,
    `条件：${entry.conditions}`,
    `方程式：${entry.equation}`,
    `产物：${entry.products.join('、')}`,
    `机制步骤（共 ${entry.mechanismSteps.length} 步）：`,
    ...entry.mechanismSteps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `产物 3D 结构的原子表（id 为准）：${JSON.stringify(atoms)}`,
    `化学键：${JSON.stringify(bonds)}`,
    '',
    '请输出严格 JSON（不要 markdown 围栏），结构如下：',
    '{',
    '  "insights": { "<原子id>": { "role": {"zh":"","en":""}, "detail": {"zh":"","en":""} } },',
    '  "stepAtomIds": [[原子id...], ..., 共' + entry.mechanismSteps.length + '组]',
    '}',
    '要求：',
    '1. insights 必须覆盖产物结构中的每一个原子 id；role 是一句话角色定位（如「被氧化的钠原子」），detail 用 2–3 句讲清该原子在本反应中经历了什么（电子得失、成键断裂/生成、现象成因）。高中人教版深度，语言准确、面向学生。',
    '2. stepAtomIds 第 i 组是第 i 步叙述所涉及的产物原子 id；某步若与产物原子无直接对应（如纯现象描述），给空数组 []。',
    '3. 化学事实必须与方程式一致，不得编造结构中不存在的原子或键。',
  ].join('\n');
}

async function callDeepSeek(entry) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是人教版高中化学资深教研员，为教材反应库的 3D 分子结构撰写双语原子讲解并标注机制步骤对应的原子。只输出合法 JSON。',
        },
        { role: 'user', content: buildPrompt(entry) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('空响应');
  return JSON.parse(content);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 主流程 ----------
const errors = [];
let processed = 0;
let skipped = 0;

for (const file of CHAPTER_FILES) {
  const path = resolve(DATA_DIR, file);
  const entries = JSON.parse(readFileSync(path, 'utf8'));
  let dirty = false;

  for (const entry of entries) {
    if (onlySlug && entry.id !== onlySlug) continue;
    if (isComplete(entry)) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`[计划] ${file} · ${entry.id} · ${entry.title}`);
      continue;
    }

    let ok = false;
    for (let attempt = 0; attempt <= RETRIES && !ok; attempt++) {
      try {
        const result = await callDeepSeek(entry);
        // 先在临时副本上合并校验，合格才落盘
        const candidate = {
          ...entry,
          atomInsights: result.insights ?? {},
          stepAtomIds: result.stepAtomIds,
        };
        const problems = validateEntry(candidate);
        if (problems.length > 0) throw new Error(`校验失败: ${problems.join('; ')}`);
        entry.atomInsights = candidate.atomInsights;
        entry.stepAtomIds = candidate.stepAtomIds;
        dirty = true;
        ok = true;
        processed += 1;
        console.log(`[完成] ${entry.id} · ${entry.title}`);
      } catch (err) {
        console.warn(`[重试${attempt}] ${entry.id}: ${err.message}`);
        if (attempt === RETRIES) errors.push({ file, id: entry.id, error: err.message });
      }
      await sleep(DELAY_MS);
    }
  }

  if (dirty && !dryRun) {
    writeFileSync(path, JSON.stringify(entries, null, 2) + '\n', 'utf8');
    console.log(`[写盘] ${file}`);
  }
}

console.log(`\n汇总：新处理 ${processed} 条，跳过（已完整）${skipped} 条，失败 ${errors.length} 条`);
if (errors.length > 0) {
  writeFileSync(resolve(ROOT, '.gen-errors.json'), JSON.stringify(errors, null, 2), 'utf8');
  console.log('失败明细已写入 .gen-errors.json');
}
