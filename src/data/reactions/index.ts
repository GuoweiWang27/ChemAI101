import { CuratedReaction } from './schema';

// 正式章节数据（每条经弈沐哥授权上线，任课老师签核后补，台账见 docs/specs/reaction-signoff.md）。
// _staging/ 下的草稿不会被导入。
import mustate102NaCl from './mustate-1-02-na-cl.json';
import mustate103Fe from './mustate-1-03-fe.json';
import mustate205Sn from './mustate-2-05-sn.json';
import mustate206Energy from './mustate-2-06-energy.json';
import mustate207Organic from './mustate-2-07-organic.json';

const CHAPTER_FILES: CuratedReaction[][] = [
  mustate102NaCl as unknown as CuratedReaction[],
  mustate103Fe as unknown as CuratedReaction[],
  mustate205Sn as unknown as CuratedReaction[],
  mustate206Energy as unknown as CuratedReaction[],
  mustate207Organic as unknown as CuratedReaction[],
];

export const ALL_REACTIONS: CuratedReaction[] = CHAPTER_FILES.flat();

const BY_SLUG = new Map(ALL_REACTIONS.map((reaction) => [reaction.id, reaction]));

export function getReaction(slug: string): CuratedReaction | undefined {
  return BY_SLUG.get(slug);
}

export const CHAPTERS: string[] = [...new Set(ALL_REACTIONS.map((r) => r.chapter))];
