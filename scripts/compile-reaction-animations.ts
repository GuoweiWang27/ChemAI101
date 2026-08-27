import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileReactionAnimationAudit,
  hasBlockingReactionAnimationAuditIssues,
} from '../utils/reactionAnimationAudit.ts';
import type { CuratedReaction } from '../src/data/reactions/schema.ts';
import { parseAnimationProfiles } from '../src/data/reactions/animationProfiles.ts';

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
const report = compileReactionAnimationAudit(reactions, profiles);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  summary: report.summary,
  manifestIssues: report.manifestIssues.length,
  entryErrors: report.entries.reduce(
    (count, entry) => count + entry.issues.filter((entryIssue) => entryIssue.severity === 'error').length,
    0,
  ),
}));
process.exitCode = hasBlockingReactionAnimationAuditIssues(report) ? 1 : 0;
