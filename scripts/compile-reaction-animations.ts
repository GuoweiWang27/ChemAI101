import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileReactionAnimationAudit,
  hasBlockingReactionAnimationAuditIssues,
} from '../utils/reactionAnimationAudit.ts';
import type { CuratedReaction } from '../src/data/reactions/schema.ts';
import { parseAnimationProfiles } from '../src/data/reactions/animationProfiles.ts';
import {
  createFlagshipReactionAnimation,
  FLAGSHIP_REACTION_IDS,
} from '../utils/flagshipReaction.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const reactionsDir = path.join(projectRoot, 'src/data/reactions');
const profilePath = path.join(reactionsDir, 'animation-profiles.json');
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(projectRoot, 'output/animation-audit/reaction-animation-audit.json');

const files = (await readdir(reactionsDir))
  .filter((name) => name.startsWith('mustate-') && name.endsWith('.json'))
  .sort();
const reactions = (
  await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(reactionsDir, name), 'utf8'))))
).flat() as CuratedReaction[];
const profiles = parseAnimationProfiles(JSON.parse(await readFile(profilePath, 'utf8')));
const compiledReactions = reactions.map((reaction) => {
  const flagshipScene = createFlagshipReactionAnimation(reaction);
  return flagshipScene ? { ...reaction, reactionAnimation: flagshipScene } : reaction;
});
const missingFlagshipScenes = FLAGSHIP_REACTION_IDS.filter((reactionId) => (
  compiledReactions.find((reaction) => reaction.id === reactionId)?.reactionAnimation?.version !== 3
));
if (missingFlagshipScenes.length > 0) {
  throw new Error(`Flagship animation audit is missing V3 scenes: ${missingFlagshipScenes.join(', ')}`);
}
const report = compileReactionAnimationAudit(compiledReactions, profiles);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  summary: report.summary,
  flagshipScenes: FLAGSHIP_REACTION_IDS.length,
  manifestIssues: report.manifestIssues.length,
  entryErrors: report.entries.reduce(
    (count, entry) => count + entry.issues.filter((entryIssue) => entryIssue.severity === 'error').length,
    0,
  ),
}));
process.exitCode = hasBlockingReactionAnimationAuditIssues(report) ? 1 : 0;
