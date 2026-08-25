import { CuratedReaction } from './schema';

// 正式章节文件在此显式登记；_staging/ 下的草稿不会被导入。
// 首个文件将在 Task 6 签核后加入，例如：
// import naClChapter from './mustate-1-02-na-cl.json';

const CHAPTER_FILES: CuratedReaction[][] = [
  // naClChapter,
];

export const ALL_REACTIONS: CuratedReaction[] = CHAPTER_FILES.flat();

const BY_SLUG = new Map(ALL_REACTIONS.map((reaction) => [reaction.id, reaction]));

export function getReaction(slug: string): CuratedReaction | undefined {
  return BY_SLUG.get(slug);
}

export const CHAPTERS: string[] = [...new Set(ALL_REACTIONS.map((r) => r.chapter))];
