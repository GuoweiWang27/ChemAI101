import { GoogleGenAI, Type } from "@google/genai";
import { ReactionResult, NamingResult, BuilderAtom, BuilderBond } from '../types';
import { Language } from '../contexts/LanguageContext';

// 支持多种环境变量读取方式（本地开发、Cloudflare Pages 等）
// @ts-expect-error - import.meta.env 在 Vite 环境中可用，但 TypeScript 类型可能未定义
const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const apiKey = 
  (viteEnv as any)?.VITE_VECTORENGINE_API_KEY || 
  (viteEnv as any)?.VECTORENGINE_API_KEY || 
  (typeof process !== 'undefined' && (process.env.VECTORENGINE_API_KEY || process.env.API_KEY)) ||
  '';

if (!apiKey) {
  throw new Error("An API Key must be set. Please configure VECTORENGINE_API_KEY in your environment variables (Cloudflare Pages: Settings > Environment Variables, or local: .env.local file)");
}

// VectorEngine AI API 地址 - baseURL 应该是基础地址，不包含 /chat/completions
const BASE_URL = 'https://api.vectorengine.ai/v1';

// 初始化 GoogleGenerativeAI SDK，设置 baseURL
// baseURL 在运行时支持，但类型定义中可能未包含，使用类型断言
const ai = new GoogleGenAI({ 
  apiKey: apiKey,
  baseURL: BASE_URL
} as any);

const modelName = "gpt-3.5-turbo";

export const predictReaction = async (reactants: string, conditions: string, language: Language): Promise<ReactionResult> => {
  const langInstruction = language === 'zh' 
    ? "Provide the explanation, mechanism steps, and products in Simplified Chinese (zh-CN)." 
    : "Provide the output in English.";

  const prompt = `
    Analyze the following chemical reaction:
    Reactants: ${reactants}
    Conditions: ${conditions}

    Perform the following tasks:
    1. Predict the products and provide the balanced chemical equation.
    2. Explain the reaction mechanism step-by-step.
    3. Generate a 3D coordinate representation (approximated VSEPR model) for the MAIN product of the reaction.

    ${langInstruction}

    Return the result strictly as JSON matching the following schema:
    {
      "equation": "string",
      "products": ["string"],
      "mechanismSteps": ["string"],
      "vseprInfo": "string (Description of the geometry, e.g. Tetrahedral)",
      "productStructure": {
        "atoms": [
          {
            "id": number,
            "element": "string",
            "x": number,
            "y": number,
            "z": number,
            "color": "string (CPK hex code)"
          }
        ],
        "bonds": [
          {
            "source": number,
            "target": number,
            "order": number
          }
        ]
      }
    }
    For atoms, provide x, y, z coordinates generally within range -5 to 5.
    Element colors should be standard CPK hex codes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            equation: { type: Type.STRING },
            products: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            mechanismSteps: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            vseprInfo: { 
              type: Type.STRING, 
              description: "Description of the geometry (e.g. Tetrahedral)" 
            },
            productStructure: {
              type: Type.OBJECT,
              properties: {
                atoms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      element: { type: Type.STRING },
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      z: { type: Type.NUMBER },
                      color: { type: Type.STRING }
                    }
                  }
                },
                bonds: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      source: { type: Type.INTEGER },
                      target: { type: Type.INTEGER },
                      order: { type: Type.INTEGER }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ReactionResult;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Reaction prediction failed:", error);
    throw error;
  }
};

export const nameMoleculeFromGraph = async (atoms: BuilderAtom[], bonds: BuilderBond[], language: Language): Promise<NamingResult> => {
  // Convert internal graph format to a simplified format for the LLM
  const graphDescription = {
    atoms: atoms.map(a => ({ id: a.id, element: a.element })),
    bonds: bonds.map(b => ({ source: b.sourceId, target: b.targetId, order: b.order }))
  };

  const langInstruction = language === 'zh' 
    ? "Provide the IUPAC name, common names, and explanation in Simplified Chinese (zh-CN)." 
    : "Provide the output in English.";

  const prompt = `
    Analyze this 2D molecular graph structure:
    ${JSON.stringify(graphDescription)}

    1. Identify the molecule.
    2. Provide its IUPAC systematic name.
    3. Provide common names (if any).
    4. Explain the naming rules applied (e.g. functional group priority, numbering).

    ${langInstruction}

    Return the result strictly as JSON matching the following schema:
    {
      "systematicName": "string",
      "commonName": "string",
      "explanation": "string"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            systematicName: { type: Type.STRING },
            commonName: { type: Type.STRING },
            explanation: { type: Type.STRING },
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as NamingResult;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Naming failed:", error);
    throw error;
  }
};
