import React from 'react';
import { MoleculeStructure } from '../types';

interface PresentationModeProps {
  equation: string;
  conditions: string;
  title: string;
  steps: string[];
  structure: MoleculeStructure | null;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = (props) => {
  void props;
  return null;
};
