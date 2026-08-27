import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getReaction } from './data/reactions';
import { LanguageProvider } from '../contexts/LanguageContext';
import { isFlagshipReactionScene } from '../utils/flagshipReaction';
import { getMacroVisualProgress, MacroPhenomenonStage } from '../components/MacroPhenomenonStage';
import { TeachingMomentCard } from '../components/TeachingMomentCard';
import { FlagshipReactionPlayer } from '../components/FlagshipReactionPlayer';
import { TextbookModule } from '../components/TextbookModule';
import { ReactionPage } from '../components/ReactionPage';
import { ProjectStoryPage } from '../components/ProjectStoryPage';
import { FlagshipMicroStage } from '../components/FlagshipMicroStage';

describe('flagship classroom experience', () => {
  it('renders macro phenomenon families and an accessible teaching prompt', () => {
    const scene = getReaction('s-o2')?.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error('s-o2 flagship scene missing');
    const macroEvent = scene.macroTrack.find((event) => event.kind === 'flame')!;
    const macroHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(MacroPhenomenonStage, {
          event: macroEvent,
          progress: 0.8,
          reducedMotion: false,
        }),
      ),
    );
    const promptHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(TeachingMomentCard, {
          moment: scene.teachingMoments[0],
          expanded: false,
          onToggle: () => undefined,
          onReplayStage: () => undefined,
        }),
      ),
    );

    expect(macroHtml).toContain('data-macro-kind="flame"');
    expect(macroHtml).toContain('教学示意');
    expect(promptHtml).toContain('课堂暂停点');
    expect(promptHtml).toContain('展开提示');
    expect(promptHtml).not.toContain('提交答案');
  });

  it('renders the synchronized flagship player contract', () => {
    const reaction = getReaction('s-o2')!;
    const scene = reaction.reactionAnimation;
    if (!isFlagshipReactionScene(scene) || !reaction.productStructure || !reaction.reactionFlow) {
      throw new Error('s-o2 flagship data missing');
    }
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(FlagshipReactionPlayer, {
          equation: reaction.equation,
          steps: reaction.mechanismSteps,
          structure: reaction.productStructure,
          flow: reaction.reactionFlow,
          scene,
          autoPlay: false,
        }),
      ),
    );

    expect(html).toContain('宏观现象');
    expect(html).toContain('微观机理');
    expect(html).toContain(scene.teachingMoments[0].question.zh);
    expect(html).toContain(reaction.equation);
    expect(html).not.toContain('提交答案');
    expect(html).toContain('data-layout="fitted-grid"');
    expect(html).toContain('data-target-size="24"');
    expect(html).not.toContain('overflow-x-auto');
  });

  it('keeps macro cards free of duplicated engineering annotations', () => {
    const scene = getReaction('na-h2o')?.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error('na-h2o flagship scene missing');
    const heatEvent = scene.macroTrack.find((event) => event.kind === 'heat-rise')!;
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(MacroPhenomenonStage, {
          event: heatEvent,
          progress: 0.7,
          reducedMotion: false,
        }),
      ),
    );
    expect(html).toContain('温度上升');
    expect(html).not.toContain('energy cue · educational abstraction');

    const solutionEvent = scene.macroTrack.find((event) => event.kind === 'solution-color')!;
    const solutionHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(MacroPhenomenonStage, {
          event: solutionEvent,
          progress: 1,
          reducedMotion: false,
        }),
      ),
    );
    expect(solutionHtml).toContain('酚酞变红');
    expect(solutionHtml).not.toContain('>pink<');
  });

  it('drives the V3 micro scene from the active micro-track kind', () => {
    const scene = getReaction('c2h4-br2')?.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error('c2h4-br2 flagship scene missing');
    const event = scene.microTrack.find((candidate) => candidate.kind === 'pi-bond-rewire')!;
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(FlagshipMicroStage, { event, progress: 0.75, reducedMotion: false }),
      ),
    );
    expect(html).toContain('data-micro-kind="pi-bond-rewire"');
    expect(html).toContain('π 键与 Br—Br 键重排');
    expect(html).toContain('Br···C—C···Br');
  });

  it('keeps cumulative color continuous and hides smoke before particles form', () => {
    const bromineScene = getReaction('c2h4-br2')?.reactionAnimation;
    const smokeScene = getReaction('nh3-hcl-smoke')?.reactionAnimation;
    if (!isFlagshipReactionScene(bromineScene) || !isFlagshipReactionScene(smokeScene)) {
      throw new Error('macro continuity data missing');
    }
    expect(getMacroVisualProgress(bromineScene.macroTrack[0], 1))
      .toBe(getMacroVisualProgress(bromineScene.macroTrack[1], 0));

    const initialSmoke = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(MacroPhenomenonStage, {
          event: smokeScene.macroTrack[0],
          progress: 0.8,
          reducedMotion: false,
        }),
      ),
    );
    expect(initialSmoke).toContain('no smoke yet');
    expect(initialSmoke).not.toContain('diffusion → visible particles');
  });

  it('marks exactly five textbook cards as classroom flagships', () => {
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(TextbookModule)),
    );
    expect((html.match(/课堂旗舰/g) ?? [])).toHaveLength(5);
  });

  it('routes flagship detail pages to the flagship player while preserving the ordinary entry', () => {
    const flagship = getReaction('s-o2')!;
    const flagshipHtml = renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(ReactionPage, {
        reaction: flagship,
        present: false,
        onExit: () => undefined,
      })),
    );
    const ordinary = getReaction('c2h4-hydration')!;
    const ordinaryHtml = renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(ReactionPage, {
        reaction: ordinary,
        present: false,
        onExit: () => undefined,
      })),
    );

    expect(flagshipHtml).toContain('宏观现象');
    expect(flagshipHtml).toContain('微观机理');
    expect(ordinaryHtml).toContain('全程动画');
  });

  it('keeps the ethene-bromine flagship model non-aqueous and labels the caveat', () => {
    const reaction = getReaction('c2h4-br2')!;
    const scene = reaction.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error('c2h4-br2 flagship scene missing');

    expect(reaction.conditions).toContain('非水惰性介质');
    expect(reaction.mechanismSteps.join(' ')).not.toContain('溴水');
    expect(scene.macroTrack.every((event) => event.params.conditionNote === '教材化非水加成模型；含水体系可能形成卤代醇')).toBe(true);
  });

  it('renders a truthful repository-derived project story', () => {
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, null, React.createElement(ProjectStoryPage)),
    );
    expect(html).toContain('40');
    expect(html).toContain('5');
    expect(html).toContain('教师课堂复核待完成');
    expect(html).toContain('原子守恒');
    expect(html).not.toMatch(/教师认证|课堂验证通过|提升\d+%|招生结果/);
  });
});
