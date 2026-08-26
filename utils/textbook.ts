import { Language } from '../contexts/LanguageContext';

export interface ChapterInfo {
  /** 卷册代号，如 '必修1' */
  volumeCode: string;
  /** 正式教材名（双语） */
  volumeLabel: Record<Language, string>;
  /** 年级学期注记（双语） */
  grade: Record<Language, string>;
  /** 卷册号之后的章节标题，如 '第二章 海水中的重要元素——钠和氯'；无分隔符时为空串 */
  chapterTitle: string;
}

/** 教材卷册显示名。键需覆盖数据中出现的全部卷册代号（见 src/data/reactions/*.json）。 */
const VOLUME_META: Record<string, { label: Record<Language, string>; grade: Record<Language, string> }> = {
  必修1: {
    label: { zh: '人教版《化学》必修第一册', en: 'PEP Chemistry · Compulsory Book 1' },
    grade: { zh: '高一上', en: 'Grade 10 · Fall' },
  },
  必修2: {
    label: { zh: '人教版《化学》必修第二册', en: 'PEP Chemistry · Compulsory Book 2' },
    grade: { zh: '高一下', en: 'Grade 10 · Spring' },
  },
};

/** 解析策展条目的 chapter 字符串（形如「必修1·第二章 …」），未知卷册优雅降级。 */
export function parseChapter(chapter: string): ChapterInfo {
  const sep = chapter.indexOf('·');
  const volumeCode = sep > 0 ? chapter.slice(0, sep) : chapter;
  const chapterTitle = sep > 0 ? chapter.slice(sep + 1) : '';
  const meta = VOLUME_META[volumeCode];
  if (meta) {
    return { volumeCode, volumeLabel: meta.label, grade: meta.grade, chapterTitle };
  }
  // 未登记的卷册：整串当章名，不编造教材信息
  return {
    volumeCode,
    volumeLabel: { zh: volumeCode, en: volumeCode },
    grade: { zh: '', en: '' },
    chapterTitle,
  };
}

/** 按卷册聚合章节名，保持首次出现顺序。返回 [{volumeCode, info, chapters:[完整章节串]}] */
export function groupChaptersByVolume(chapters: string[]): Array<{
  volumeCode: string;
  info: ChapterInfo;
  chapters: string[];
}> {
  const order: string[] = [];
  const byVolume = new Map<string, { info: ChapterInfo; chapters: string[] }>();
  for (const chapter of chapters) {
    const info = parseChapter(chapter);
    if (!byVolume.has(info.volumeCode)) {
      order.push(info.volumeCode);
      byVolume.set(info.volumeCode, { info, chapters: [] });
    }
    byVolume.get(info.volumeCode)!.chapters.push(chapter);
  }
  return order.map((volumeCode) => ({ volumeCode, ...byVolume.get(volumeCode)! }));
}
