import { ReactionResult, NamingResult, BuilderAtom, BuilderBond } from '../types';
import { Language } from '../contexts/LanguageContext';

// 1. 读取 API Key (适配 Vite 环境变量)
// @ts-expect-error - import.meta.env check
const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const apiKey = 
  (viteEnv as any)?.VITE_VECTORENGINE_API_KEY || 
  (viteEnv as any)?.VECTORENGINE_API_KEY || 
  (typeof process !== 'undefined' && (process.env.VECTORENGINE_API_KEY || process.env.API_KEY)) ||
  '';

if (!apiKey) {
  throw new Error("An API Key must be set. Please configure VITE_VECTORENGINE_API_KEY in Cloudflare.");
}

// 2. 配置 Vector Engine (必须用 HTTPS，防止浏览器拦截)
const API_URL = 'https://api.vectorengine.ai/v1/chat/completions';
// 3. 模型名称 (Vector Engine 通常兼容 gpt-3.5-turbo，用这个最稳)
const modelName = "gemini-2.5-flash";

export const predictReaction = async (reactants: string, conditions: string, language: Language): Promise<ReactionResult> => {
  const langInstruction = language === 'zh' ? "Provide output in Simplified Chinese." : "Provide output in English.";
  
  // 构造 OpenAI 格式的 Prompt
  const prompt = `
    Analyze reaction: ${reactants} under ${conditions}.
    1. Predict products & balanced equation.
    2. Mechanism steps.
    3. 3D VSEPR info for main product (atoms x,y,z approx -5 to 5, CPK colors).
    ${langInstruction}
    Return strictly JSON matching this structure:
    {
      "equation": "string",
      "products": ["string"],
      "mechanismSteps": ["string"],
      "vseprInfo": "string",
      "productStructure": {
        "atoms": [{ "id": 1, "element": "C", "x": 0, "y": 0, "z": 0, "color": "#909090" }],
        "bonds": [{ "source": 1, "target": 2, "order": 1 }]
      }
    }
  `;

  try {
    // 使用原生 fetch 发送请求 (绕过 Google SDK)
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // 发送 sk- 密钥
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }], // OpenAI 格式
        response_format: { type: 'json_object' },      // 强制 JSON
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    return JSON.parse(content) as ReactionResult;
  } catch (error) {
    console.error("Reaction failed:", error);
    throw error;
  }
};

export const nameMoleculeFromGraph = async (atoms: BuilderAtom[], bonds: BuilderBond[], language: Language): Promise<NamingResult> => {
  const graphData = { atoms: atoms.map(a => ({e: a.element})), bonds: bonds.map(b => ({s: b.sourceId, t: b.targetId, o: b.order})) };
  const langInstruction = language === 'zh' ? "Use Simplified Chinese." : "Use English.";

  const prompt = `Name this molecule: ${JSON.stringify(graphData)}. ${langInstruction} Return JSON: { "systematicName": "", "commonName": "", "explanation": "" }`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API Error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    return JSON.parse(content) as NamingResult;
  } catch (error) {
    console.error("Naming failed:", error);
    throw error;
  }
};