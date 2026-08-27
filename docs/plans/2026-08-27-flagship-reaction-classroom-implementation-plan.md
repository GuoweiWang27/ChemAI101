# CHEMAI101 Flagship Reaction Classroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project uses a root-audit workflow, so replace each task's normal commit with a clean checkpoint and leave all implementation changes uncommitted for the primary task to review.

**Goal:** Upgrade five textbook reactions into synchronized macro/micro classroom flagships with teaching pause points and add a truthful project-story entry without regressing the existing 40-reaction library or homepage counter.

**Architecture:** Add a backward-compatible scene v3 layer that is compiled from five explicit flagship blueprints plus the existing reaction flow. Render v3 scenes through a new controlled dual-track player while leaving the v1/v2 player unchanged for all other reactions. Keep chemistry evidence and project chemistry approval separate from teacher-review status, and expose only repository-derived project metrics.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 4, Three.js / React Three Fiber, Tailwind CSS, Cloudflare Pages + Worker.

---

## File map

**Create**

- `src/data/reactions/flagshipScenes.ts` — five explicit blueprint records, teaching prompts, evidence and scene-v3 compiler input.
- `utils/flagshipReaction.ts` — compile a blueprint and existing reaction flow into a v3 scene; expose type guards and timeline helpers.
- `utils/flagshipReaction.test.ts` — prove flagship coverage, stage synchronization, review separation and local replay boundaries.
- `components/MacroPhenomenonStage.tsx` — deterministic CSS/SVG macro phenomena renderer driven only by macro events.
- `components/TeachingMomentCard.tsx` — accessible prompt/hint card with no scoring or persistence.
- `components/FlagshipReactionPlayer.tsx` — synchronized macro/micro player with desktop split view and mobile tabs.
- `components/ProjectStoryPage.tsx` — truthful project explanation and repository-derived status.
- `src/flagshipExperience.test.ts` — server-render and source-contract regression tests for flagship/project UI.

**Modify**

- `src/data/reactions/schema.ts` — add scene-v3, track, teaching, camera and review types.
- `src/data/reactions/index.ts` — compile only the five blueprint reactions into v3 while preserving all other records.
- `src/data/reactions/animation-profiles.json` — raise the four new flagships to L2 with evidence-backed project chemistry review; retain `na-h2o` as L3.
- `src/data/reactions/data.test.ts` — accept versions 1–3 and validate v3 fields.
- `utils/reactionAnimation.ts` — make common snapshot/event utilities version-3 aware.
- `utils/reactionAnimationAudit.ts` — validate v3 tracks, references, review status and flagship minimums.
- `utils/reactionAnimationAudit.test.ts` — add fail-closed v3 cases and update expected quality counts.
- `utils/reactionAnimationV2.test.ts` — retain v1/v2 compatibility while asserting five v3 scenes.
- `utils/reactionAnimationVisuals.ts` and `utils/reactionAnimationVisuals.test.ts` — allow v3 to reuse the existing effect dispatcher and conservation gate.
- `components/ReactionPage.tsx` — route v3 scenes to the flagship player and show a flagship badge.
- `components/PresentationMode.tsx` — use the flagship player for v3 classroom presentation.
- `components/TextbookModule.tsx` — make the five flagship cards discoverable.
- `components/HomeModule.tsx` — add a visible project-story entry without changing `LiveStatsLine`.
- `App.tsx` — add a project tab and lazy-load the project page.
- `contexts/LanguageContext.tsx` — add complete Chinese/English interface copy and remove unproved teacher-collaboration wording.

## Task 1: Define the v3 contract and fail-first data tests

**Files:**

- Modify: `src/data/reactions/schema.ts`
- Modify: `src/data/reactions/data.test.ts`
- Create: `utils/flagshipReaction.test.ts`

- [ ] **Step 1: Write the failing flagship coverage test**

Create `utils/flagshipReaction.test.ts` with these exact invariants:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, getReaction } from '../src/data/reactions';
import { FLAGSHIP_REACTION_IDS } from '../src/data/reactions/flagshipScenes';
import { isFlagshipReactionScene } from './flagshipReaction';

describe('flagship reaction scene v3', () => {
  it('publishes exactly the five approved classroom flagships', () => {
    expect(FLAGSHIP_REACTION_IDS).toEqual([
      'na-h2o',
      's-o2',
      'nh3-hcl-smoke',
      'c2h4-br2',
      'cao-water-exothermic',
    ]);
    expect(ALL_REACTIONS.filter((reaction) => isFlagshipReactionScene(reaction.reactionAnimation)))
      .toHaveLength(5);
  });

  it.each(FLAGSHIP_REACTION_IDS)('%s has classroom tracks and pending teacher review', (reactionId) => {
    const scene = getReaction(reactionId)?.reactionAnimation;
    expect(scene?.version).toBe(3);
    if (!isFlagshipReactionScene(scene)) throw new Error(`${reactionId} missing v3 scene`);
    expect(scene.stages.length).toBeGreaterThanOrEqual(4);
    expect(scene.teachingMoments.length).toBeGreaterThanOrEqual(3);
    expect(scene.macroTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.microTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.equationTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.review.chemistryStatus).toBe('passed');
    expect(scene.review.teacherStatus).toBe('pending');
    expect(scene.evidence.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run utils/flagshipReaction.test.ts`

Expected: FAIL because `flagshipScenes` and `flagshipReaction` do not exist.

- [ ] **Step 3: Add the v3 types**

Append these types to `src/data/reactions/schema.ts`; reuse existing `BilingualText`, `ReactionAnimationSceneV2`, `ReactionAnimationEquationFocus` and `ReactionAnimationEvidence`:

```ts
export type FlagshipMacroKind =
  | 'metal-on-water'
  | 'flame'
  | 'smoke'
  | 'solution-color'
  | 'solid-hydration'
  | 'heat-rise';

export interface FlagshipTrackEvent {
  id: string;
  stageId: string;
  at: number;
  duration: number;
  label: BilingualText;
  kind: string;
  params: Record<string, string | number | boolean | number[] | string[]>;
}

export interface FlagshipTeachingMoment {
  id: string;
  stageId: string;
  at: number;
  question: BilingualText;
  hint: BilingualText;
  expectedObservation: BilingualText;
}

export interface FlagshipCameraShot {
  stageId: string;
  target: 'macro' | 'micro' | 'split';
  zoom: number;
}

export interface ReactionAnimationSceneV3 extends Omit<ReactionAnimationSceneV2, 'version'> {
  version: 3;
  macroTrack: Array<FlagshipTrackEvent & { kind: FlagshipMacroKind }>;
  microTrack: FlagshipTrackEvent[];
  equationTrack: Array<FlagshipTrackEvent & { kind: ReactionAnimationEquationFocus }>;
  teachingMoments: FlagshipTeachingMoment[];
  cameraShots?: FlagshipCameraShot[];
  evidence: ReactionAnimationEvidence[];
  review: {
    chemistryStatus: 'pending' | 'passed' | 'blocked';
    teacherStatus: 'pending' | 'reviewed';
  };
}
```

Change the union to:

```ts
export type ReactionAnimationScene =
  | ReactionAnimationSceneV1
  | ReactionAnimationSceneV2
  | ReactionAnimationSceneV3;
```

- [ ] **Step 4: Generalize the dataset version assertion**

In `src/data/reactions/data.test.ts`, replace the hard-coded `expect(animation.version).toBe(1)` with:

```ts
expect([1, 2, 3]).toContain(animation.version);
```

For v3 scenes also assert that every track event references a real stage and remains within `duration`.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run src/data/reactions/data.test.ts utils/flagshipReaction.test.ts`

Expected: schema/data tests compile; flagship tests still FAIL because no blueprints are connected.

- [ ] **Checkpoint 1: Inspect the diff; do not commit**

Run: `git diff --check && git status --short`

Expected: only Task 1 paths are changed or created.

## Task 2: Compile the five evidence-backed flagship scenes

**Files:**

- Create: `src/data/reactions/flagshipScenes.ts`
- Create: `utils/flagshipReaction.ts`
- Modify: `src/data/reactions/index.ts`
- Modify: `src/data/reactions/animation-profiles.json`
- Test: `utils/flagshipReaction.test.ts`

- [ ] **Step 1: Define the exact flagship IDs and blueprint interface**

Create `src/data/reactions/flagshipScenes.ts` with:

```ts
import type {
  FlagshipCameraShot,
  FlagshipTeachingMoment,
  FlagshipTrackEvent,
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

export interface FlagshipBlueprint {
  reactionId: FlagshipReactionId;
  qualityLevel: ReactionAnimationQualityLevel;
  stageLabels: Array<{
    id: string;
    labelZh: string;
    labelEn: string;
    statusZh: string;
    statusEn: string;
    equationFocus: 'reactants' | 'change' | 'products' | 'observation';
  }>;
  macroKinds: Array<'metal-on-water' | 'flame' | 'smoke' | 'solution-color' | 'solid-hydration' | 'heat-rise'>;
  microKinds: string[];
  teachingMoments: Omit<FlagshipTeachingMoment, 'stageId' | 'at'>[];
  evidence: ReactionAnimationEvidence[];
  cameraShots?: FlagshipCameraShot[];
}
```

- [ ] **Step 2: Enter the five complete blueprint records**

Use 4–5 stages per reaction with these exact stage narratives and three teaching questions each:

| Reaction | Stage labels in order | Macro kinds in order | Teaching questions in order |
| --- | --- | --- | --- |
| `na-h2o` | 初始观察 → 接触放热 → 电子转移 → 氢气形成 → 碱性溶液 | metal-on-water, heat-rise, metal-on-water, metal-on-water, solution-color | 为什么钠浮在水面？ / 气泡来自哪个反应物？ / 方程式系数为什么是 2:2:2:1？ |
| `s-o2` | 硫受热 → 点燃 → 硫氧键形成 → 二氧化硫扩散 | heat-rise, flame, flame, smoke | 加热是反应物还是条件？ / 生成物为什么写作 SO₂？ / 蓝色火焰属于宏观证据还是微观解释？ |
| `nh3-hcl-smoke` | 两种气体分布 → 扩散相遇 → 质子转移 → 氯化铵微粒聚集 | smoke, smoke, smoke, smoke | 白烟是气体还是固体小颗粒？ / 为什么两种无色气体会产生可见现象？ / 微观图中电荷如何守恒？ |
| `c2h4-br2` | 反应物展示 → 双键区域接近 → 键发生变化 → 加成产物形成 → 溴颜色褪去 | solution-color, solution-color, solution-color, solution-color, solution-color | 褪色能说明什么？ / 乙烯分子中哪一部分发生变化？ / 加成前后原子数是否改变？ |
| `cao-water-exothermic` | 固体与水分开 → 水接触固体 → 氢氧化物形成 → 放热 → 熟石灰形成 | solid-hydration, solid-hydration, solid-hydration, heat-rise, solid-hydration | 温度升高说明能量如何变化？ / 水是反应物还是只起溶剂作用？ / 为什么产物俗名是熟石灰？ |

For every question provide a concrete bilingual hint and expected observation. Use these evidence records:

```ts
const EVIDENCE = {
  'na-h2o': 'https://edu.rsc.org/experiments/reactivity-trends-of-the-alkali-metals/731.article',
  's-o2': 'https://edu.rsc.org/experiments/reacting-elements-with-oxygen/705.article',
  'nh3-hcl-smoke': 'https://edu.rsc.org/experiments/making-and-testing-ammonia/433.article',
  'c2h4-br2': 'https://openstax.org/books/organic-chemistry/pages/8-2-halogenation-of-alkenes-addition-of-x2',
  'cao-water-exothermic': 'https://edu.rsc.org/resources/cool-drinking-problem-based-practical-activities/4018033.article',
} satisfies Record<FlagshipReactionId, string>;
```

The `c2h4-br2` blueprint must label the modeled system as bromine in a non-aqueous inert medium and use red-brown → colourless. Add the visible note “教材化非水加成模型；含水体系可能形成卤代醇” so the dibromo product is not conflated with bromine-water chemistry. The sodium blueprint may show a yellow flame only as conditional (`mayIgnite: true`), matching the RSC demonstration note.

- [ ] **Step 3: Implement the compiler**

In `utils/flagshipReaction.ts`, export:

```ts
export function isFlagshipReactionScene(
  scene: ReactionAnimationScene | undefined,
): scene is ReactionAnimationSceneV3 {
  return scene?.version === 3;
}

export function createFlagshipReactionAnimation(
  reaction: CuratedReaction,
): ReactionAnimationSceneV3 | null;

export function getFlagshipStageReplayRange(
  scene: ReactionAnimationSceneV3,
  stageId: string,
): { start: number; end: number } | null;

export function safelyCreateFlagshipReactionAnimation(
  reaction: CuratedReaction,
): ReactionAnimationSceneV3 | null;
```

Compiler rules:

1. Return `null` for IDs outside `FLAGSHIP_REACTION_IDS`.
2. Require `reactionFlow` and `productStructure`; throw a reaction-ID-specific error if either is missing. The public safe wrapper catches this and returns `null`, so the UI retains the original v1/v2 path while the offline flagship audit still fails the build.
3. Use the embedded sodium v1 actors when present; use `createFallbackReactionAnimation(reaction)` for the other four.
4. Normalize all events to timed v2-style events and keep all effect references valid.
5. Allocate 3 seconds per blueprint stage and make stages contiguous from 0 to `duration`.
6. Generate one macro, micro and equation event per stage; teaching moments attach to stages 2, 3 and the final stage.
7. Copy profile evidence, set `review.chemistryStatus = 'passed'`, and always set `review.teacherStatus = 'pending'`.

- [ ] **Step 4: Overlay compiled scenes in the reaction index**

In `src/data/reactions/index.ts`, compile the chapter records once through the safe wrapper:

```ts
const RAW_REACTIONS = CHAPTER_FILES.flat();

export const ALL_REACTIONS: CuratedReaction[] = RAW_REACTIONS.map((reaction) => {
  const flagshipScene = safelyCreateFlagshipReactionAnimation(reaction);
  return flagshipScene ? { ...reaction, reactionAnimation: flagshipScene } : reaction;
});
```

Import `safelyCreateFlagshipReactionAnimation` from `../../../utils/flagshipReaction`. `flagshipReaction.ts` may import `schema`, `flagshipScenes`, `animationProfiles` and `reactionAnimation`, but must not import `src/data/reactions/index.ts`; this keeps the dependency graph acyclic.

- [ ] **Step 5: Raise project chemistry quality without claiming teacher review**

In `animation-profiles.json`, change `s-o2`, `nh3-hcl-smoke`, `c2h4-br2` and `cao-water-exothermic` to:

```json
{
  "qualityLevel": "L2",
  "illustrativeOnly": false,
  "mappingReview": {
    "status": "complete",
    "reviewedAt": "2026-08-27",
    "reviewer": "CHEMAI101 phase-2 evidence audit"
  },
  "chemistrySignoff": {
    "status": "approved",
    "reviewedAt": "2026-08-27",
    "reviewer": "CHEMAI101 phase-2 evidence audit",
    "note": "Project chemistry review; independent teacher classroom review remains pending"
  }
}
```

Add the corresponding RSC evidence URL to each profile. Keep sodium at L3 and add a separate `note` that teacher classroom review remains pending.

- [ ] **Step 6: Run the flagship tests**

Run: `npx vitest run utils/flagshipReaction.test.ts src/data/reactions/data.test.ts`

Expected: PASS; exactly five v3 scenes, all with pending teacher review.

- [ ] **Checkpoint 2: Inspect the data diff; do not commit**

Run: `git diff --check && git status --short`

Expected: Task 1–2 paths only.

## Task 3: Extend the offline audit and fail closed

**Files:**

- Modify: `utils/reactionAnimation.ts`
- Modify: `utils/reactionAnimationAudit.ts`
- Modify: `utils/reactionAnimationAudit.test.ts`
- Modify: `utils/reactionAnimationV2.test.ts`
- Modify: `utils/reactionAnimationVisuals.ts`
- Modify: `utils/reactionAnimationVisuals.test.ts`

- [ ] **Step 1: Write the failing v3 audit tests**

Add tests that clone `s-o2` v3 and independently break:

```ts
expect(validateReactionAnimationScene({ ...scene, teachingMoments: [] }, reaction))
  .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'FLAGSHIP_TEACHING_MOMENTS_MISSING' })]));

expect(validateReactionAnimationScene({
  ...scene,
  macroTrack: [{ ...scene.macroTrack[0], stageId: 'ghost' }, ...scene.macroTrack.slice(1)],
}, reaction)).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'FLAGSHIP_TRACK_UNKNOWN_STAGE' }),
]));

expect(validateReactionAnimationScene({
  ...scene,
  review: { ...scene.review, teacherStatus: 'reviewed' },
}, reaction)).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'TEACHER_REVIEW_EVIDENCE_MISSING' }),
]));
```

The final case must fail unless an evidence record has an ID beginning `teacher-review-` and a non-empty URL.

- [ ] **Step 2: Run the focused audit tests and verify failure**

Run: `npx vitest run utils/reactionAnimationAudit.test.ts utils/reactionAnimationV2.test.ts utils/reactionAnimationVisuals.test.ts`

Expected: FAIL because v3 rules are not implemented.

- [ ] **Step 3: Make common animation utilities version-3 aware**

Treat v3 timed events/effects exactly like v2 in `getActiveAnimationEvents`, `getActiveAnimationEffects`, `getAnimationPrimaryFamily` and the visual dispatcher. Do not broaden the v1 branch.

- [ ] **Step 4: Add the v3 audit rules**

For `scene.version === 3`, validate:

- at least 4 contiguous stages;
- at least 3 teaching moments;
- at least one macro, micro and equation event per stage;
- every track event references a stage and stays within both the stage interval and scene duration;
- every teaching moment references a stage and its `at` lies within that stage;
- evidence list is non-empty and every URL uses `https:`;
- `teacherStatus: reviewed` requires a `teacher-review-*` evidence record with URL;
- L2/L3 still uses the existing conservation eligibility gate;
- any v3 error blocks `animation:audit`.

- [ ] **Step 5: Update expected audit counts**

Keep totals at 40 reactions, 40 profiles, 38 flows, 8 complete mappings, 30 incomplete mappings and 2 missing flows. Assert the five flagship entries have quality gates `pass`, with sodium declared L3 and the other four declared L2.

- [ ] **Step 6: Run the audit suite and compiler**

Run:

```bash
npx vitest run utils/reactionAnimationAudit.test.ts utils/reactionAnimationV2.test.ts utils/reactionAnimationVisuals.test.ts
npm run animation:audit
```

Expected: all tests PASS; compiler exits 0 with 40 reactions and no blocking issues.

- [ ] **Checkpoint 3: Inspect the audit diff; do not commit**

Run: `git diff --check && git status --short`

## Task 4: Build the macro renderer and teaching card

**Files:**

- Create: `components/MacroPhenomenonStage.tsx`
- Create: `components/TeachingMomentCard.tsx`
- Create: `src/flagshipExperience.test.ts`

- [ ] **Step 1: Write server-render contracts**

Render each component through `LanguageProvider` and assert:

```ts
expect(macroHtml).toContain('data-macro-kind="flame"');
expect(macroHtml).toContain('教学示意');
expect(promptHtml).toContain('课堂暂停点');
expect(promptHtml).toContain('展开提示');
expect(promptHtml).not.toContain('提交答案');
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run src/flagshipExperience.test.ts`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement `MacroPhenomenonStage`**

Props:

```ts
interface MacroPhenomenonStageProps {
  event: ReactionAnimationSceneV3['macroTrack'][number];
  progress: number;
  reducedMotion: boolean;
}
```

Render the five deterministic families with CSS/SVG only:

- `metal-on-water`: water surface, one sodium bead, a motion trail and bubbles; conditional flame only when `params.mayIgnite === true` and progress > 0.65.
- `flame`: blue/blue-violet layered flame with no strobe.
- `smoke`: two opposing gas streams merging into a white particle cloud.
- `solution-color`: a vessel interpolating between `params.from` and `params.to` plus a plain-text colour label.
- `solid-hydration`: white solid fragments, water contact front and product expansion.
- `heat-rise`: thermometer/heat-wave cue with numerical values only when the blueprint supplies measured data; otherwise say “温度上升”.

Always include a visible “教学示意，非真实比例或速率” note. Under reduced motion, freeze spatial movement and represent progress by opacity/labels.

- [ ] **Step 4: Implement `TeachingMomentCard`**

Props:

```ts
interface TeachingMomentCardProps {
  moment: FlagshipTeachingMoment;
  expanded: boolean;
  onToggle: () => void;
  onReplayStage: () => void;
}
```

Use a semantic `<aside>`, a heading, question text, an `aria-expanded` hint button and a separate “重播本阶段” button. No input, answer submission, scoring or storage.

- [ ] **Step 5: Run component tests**

Run: `npx vitest run src/flagshipExperience.test.ts`

Expected: PASS.

- [ ] **Checkpoint 4: Inspect the component diff; do not commit**

Run: `git diff --check && git status --short`

## Task 5: Build the synchronized flagship player

**Files:**

- Create: `components/FlagshipReactionPlayer.tsx`
- Modify: `src/flagshipExperience.test.ts`

- [ ] **Step 1: Add failing pure timeline tests**

Test `getFlagshipStageReplayRange` for the first, middle and final stage, plus an unknown stage returning `null`. Test that a time exactly at a boundary activates only the next stage.

- [ ] **Step 2: Implement the controlled player**

Use one `time` state for all four tracks. Required state:

```ts
const [time, setTime] = useState(0);
const [playing, setPlaying] = useState(autoPlay && !reducedMotion);
const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);
const [mobileTrack, setMobileTrack] = useState<'macro' | 'micro'>('macro');
const [autoPause, setAutoPause] = useState(false);
const [expandedMomentId, setExpandedMomentId] = useState<string | null>(null);
```

Use `getAnimationSnapshot(scene, time)` and derive the active macro/micro/equation events from the same time. Render:

- desktop: `lg:grid-cols-2`, macro left and `ReactionFlowScene` micro right;
- mobile: two `role="tab"` controls and one visible panel, preserving `time` while switching;
- header: stage title and L2/L3 badge;
- equation bar: reactants/change/products highlight from the active equation event;
- timeline: stage markers, teaching markers and range input;
- controls: previous stage, play/pause, next stage, replay current stage, speed and auto-pause toggle;
- teaching card: current moment only, never modal.

Keep `selectedAtomId` in the player and pass it to `ReactionFlowScene`. When an atom is selected, preserve the stage-based equation cue and add an accessible “当前观察原子” label beside the highlighted reactant/product side; clearing the selection restores the ordinary stage label.

When auto-pause is enabled, pause once when crossing each teaching moment. Track consumed moment IDs in a ref and clear them on full replay. Stage replay seeks to the stage start, removes consumed IDs for moments in that stage and starts playback.

- [ ] **Step 3: Add keyboard and reduced-motion behavior**

- Space toggles playback when focus is inside the player but not on a button/input.
- Left/right arrows jump stage boundaries.
- All controls have Chinese/English accessible names.
- `prefers-reduced-motion` defaults to paused and passes `reducedMotion` to the macro renderer.

- [ ] **Step 4: Add server-render contracts**

Assert the initial HTML contains “宏观现象”, “微观机理”, “课堂暂停点”, the equation, and no answer-submission UI.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run utils/flagshipReaction.test.ts src/flagshipExperience.test.ts`

Expected: PASS.

- [ ] **Checkpoint 5: Inspect the player diff; do not commit**

Run: `git diff --check && git status --short`

## Task 6: Integrate flagships without regressing ordinary reactions

**Files:**

- Modify: `components/ReactionPage.tsx`
- Modify: `components/PresentationMode.tsx`
- Modify: `components/TextbookModule.tsx`
- Modify: `contexts/LanguageContext.tsx`
- Modify: `src/flagshipExperience.test.ts`

- [ ] **Step 1: Add failing integration contracts**

Server-render `TextbookModule` and assert exactly five “课堂旗舰” badges. Render a flagship `ReactionPage` and assert it includes the flagship player. Render a non-flagship reaction and assert it retains the existing “全程动画” entry.

- [ ] **Step 2: Route v3 scenes explicitly**

In `ReactionPage` and `PresentationMode`, branch only on `isFlagshipReactionScene(animation)`:

```tsx
{isFlagshipReactionScene(animation) ? (
  <FlagshipReactionPlayer
    equation={reaction.equation}
    structure={reaction.productStructure}
    flow={reaction.reactionFlow}
    scene={animation}
    autoPlay
  />
) : (
  <ReactionAnimationPlayer {...existingProps} />
)}
```

For `PresentationMode`, pass the full `reaction` object instead of disconnected fields only if that reduces duplicated branching; preserve the public `onClose` behavior and Escape/fullscreen shortcuts.

- [ ] **Step 3: Add flagship discovery badges**

In `TextbookModule`, use `isFlagshipReactionScene(r.reactionAnimation)` to render “课堂旗舰 · L2/L3” under the equation. Do not infer flagships from title text.

- [ ] **Step 4: Add bilingual interface copy and correct old claims**

Add translations for all new controls. Change the current unverified copy:

- English `curatedIntro`: “Classic reactions from the PEP high-school textbook, organized for classroom explanation. Teacher review status is shown separately.”
- Chinese `curatedIntro`: “按人教版教材章节整理的典型反应，用于课堂讲解；教师审核状态单独记录。”
- Replace “classroom-ready reactions” / “课堂演示首选” language with factual “published textbook reactions” / “已整理教材反应”.

Also change the schema comment and dataset-test title that currently equate `reviewed: true` with teacher signoff. Keep the compatibility field, but document it as project content review/publication authorization; the authoritative teacher status for flagships is `scene.review.teacherStatus`.

- [ ] **Step 5: Run integration and full unit tests**

Run:

```bash
npx vitest run src/flagshipExperience.test.ts src/data/reactions/data.test.ts
npm test
```

Expected: PASS; pretest audit also exits 0.

- [ ] **Checkpoint 6: Inspect integration diff; do not commit**

Run: `git diff --check && git status --short`

## Task 7: Add the truthful project story entry

**Files:**

- Create: `components/ProjectStoryPage.tsx`
- Modify: `components/HomeModule.tsx`
- Modify: `App.tsx`
- Modify: `contexts/LanguageContext.tsx`
- Modify: `src/flagshipExperience.test.ts`

- [ ] **Step 1: Add the failing truthfulness test**

Server-render the page and assert:

```ts
expect(html).toContain('40');
expect(html).toContain('5');
expect(html).toContain('教师课堂复核待完成');
expect(html).toContain('原子守恒');
expect(html).not.toMatch(/教师认证|课堂验证通过|提升\d+%|招生结果/);
```

- [ ] **Step 2: Implement `ProjectStoryPage`**

Render four factual sections:

1. 问题：现象、方程式和微观解释常被割裂。
2. 方法：数据驱动 scene v3 and synchronized macro/micro/equation/teaching tracks.
3. 质量：40 profiles, 38 flows, 8 complete mappings, 5 flagships, atom/event/audit gates; label these as repository audit facts dated 2026-08-27.
4. 当前边界：teacher classroom review pending; animations are educational abstractions, not real kinetics or experiment videos.

Use constants derived from `ALL_REACTIONS`, `FLAGSHIP_REACTION_IDS` and the checked-in audit contract where possible. Do not fetch homepage usage numbers or repeat the counter on this page.

- [ ] **Step 3: Add a discoverable route**

Extend `activeTab` with `'project'`, lazy-load `ProjectStoryPage`, add a desktop/mobile nav item “项目说明 / Project”, and add a full-width home card below the four product modules. Keep `LiveStatsLine` and its surrounding status bar unchanged.

- [ ] **Step 4: Run story and counter regression tests**

Run:

```bash
npx vitest run src/flagshipExperience.test.ts src/liveStatsLine.test.ts
```

Expected: PASS; homepage placeholder still contains `已累计 … 次化学探索`.

- [ ] **Checkpoint 7: Inspect the story diff; do not commit**

Run: `git diff --check && git status --short`

## Task 8: Complete verification and local visual QA

**Files:**

- Modify only files required to fix failures found by the commands below.

- [ ] **Step 1: Run static, test, audit and build gates**

Run in order:

```bash
npx tsc --noEmit
npm test
npm run animation:audit
npm run build
npm run worker:check
```

Expected: every command exits 0; Vite entry remains under the configured 500 KiB budget.

- [ ] **Step 2: Start the production preview**

Run: `npm run preview -- --host 127.0.0.1 --port 4173`

Expected: preview serves `http://127.0.0.1:4173`.

- [ ] **Step 3: Perform browser QA at three viewports**

Inspect 1280×720, 1440×900 and 390×844. Verify:

- homepage counter line remains visible before and after its request;
- textbook library count remains 40 and exactly five cards show “课堂旗舰”;
- all five flagship URLs open, play, pause, jump stages, replay a stage and show at least three teaching moments;
- desktop shows macro/micro together; mobile tabs switch without resetting time;
- project page states teacher review pending and contains no invented endorsement;
- one non-flagship reaction still uses the old player;
- reduced-motion emulation starts paused and removes strong movement;
- 200% text zoom keeps equation, teaching prompt and playback controls usable;
- no overflow, clipped controls, blank canvas or console error.

- [ ] **Step 4: Capture evidence for the primary audit**

Save screenshots outside the repository or under an already ignored temp path with names:

```text
phase2-home-1440.png
phase2-na-h2o-1280.png
phase2-s-o2-390.png
phase2-project-1440.png
```

Record the local URL, viewport and observed result in the task response. Do not add screenshots to Git.

- [ ] **Step 5: Final implementation handoff; do not commit, push or deploy**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Report:

- changed/created paths;
- exact commands and pass/fail counts;
- local QA evidence paths;
- any chemistry or interaction uncertainty;
- confirmation that no commit, push or deployment was performed.

The primary task will conduct the independent code audit, request fixes if needed, then own the final commit, push, Cloudflare deployment and production verification.
