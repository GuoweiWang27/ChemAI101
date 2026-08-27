import type {
  ReactionAnimationChemistrySignoff,
  ReactionAnimationMappingReview,
  ReactionAnimationQualityLevel,
} from '../src/data/reactions/schema';

export interface ReactionAnimationGateInput {
  qualityLevel: ReactionAnimationQualityLevel;
  illustrativeOnly: boolean;
  mappingReview: Pick<ReactionAnimationMappingReview, 'status'>;
  chemistrySignoff: Pick<ReactionAnimationChemistrySignoff, 'status'>;
}

/** The audit and the renderer must use exactly the same conservation eligibility rule. */
export function isReactionAnimationConservationEligible(input: ReactionAnimationGateInput): boolean {
  return (input.qualityLevel === 'L2' || input.qualityLevel === 'L3')
    && input.illustrativeOnly === false
    && input.mappingReview.status === 'complete'
    && input.chemistrySignoff.status === 'approved';
}
