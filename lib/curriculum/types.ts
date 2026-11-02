/**
 * Types for the Victorian Curriculum F–10 Version 2.0 dataset (Foundation to Level 6).
 *
 * Source: VCAA "Download curriculum" CSV export (https://f10.vcaa.vic.edu.au/download-curriculum).
 * © VCAA — used here for personal, non-commercial educational purposes.
 */

export const PRIMARY_LEVELS = ["F", "1", "2", "3", "4", "5", "6"] as const;
export type PrimaryLevel = (typeof PRIMARY_LEVELS)[number];

export const LEVEL_LABELS: Record<PrimaryLevel, string> = {
  F: "Foundation",
  "1": "Level 1 (Year 1)",
  "2": "Level 2 (Year 2)",
  "3": "Level 3 (Year 3)",
  "4": "Level 4 (Year 4)",
  "5": "Level 5 (Year 5)",
  "6": "Level 6 (Year 6)",
};

export type LearningArea =
  | "English"
  | "Mathematics"
  | "Science"
  | "Humanities"
  | "The Arts"
  | "Technologies"
  | "Health and Physical Education"
  | "Languages"
  | "Capabilities";

export interface ContentDescription {
  /** VCAA code, e.g. "VC2M3N01". */
  code: string;
  /** Strand heading, e.g. "Number". */
  strand: string;
  /** Sub-strand where the curriculum has one, e.g. "Phonics and word knowledge". */
  subStrand?: string;
  /** Verbatim content description. */
  text: string;
  /** VCAA elaborations: optional, non-mandatory examples of how it may be taught. */
  elaborations: string[];
}

/**
 * Some subjects are written per level (e.g. Mathematics "Level 3"), others per band
 * (e.g. The Arts "Levels 3 and 4", Languages "Foundation to Level 2").
 */
export interface CurriculumBand {
  /** VCAA label, e.g. "Level 3", "Levels 5 and 6", "Foundation to Level 2". */
  band: string;
  /** Primary levels the band covers, e.g. ["5", "6"]. */
  levels: PrimaryLevel[];
  achievementStandard: string;
  contentDescriptions: ContentDescription[];
}

export interface SubjectCurriculum {
  /** e.g. "Mathematics", "Visual Arts", "Chinese (Second Language Learner)". */
  subject: string;
  slug: string;
  learningArea: LearningArea;
  /** Languages only, e.g. "Curriculum F–10 Sequence". */
  sequence?: string;
  source: string;
  retrievedAt: string;
  bands: CurriculumBand[];
}

export interface CurriculumIndex {
  version: "Victorian Curriculum F–10 Version 2.0";
  source: string;
  retrievedAt: string;
  subjects: Array<{
    subject: string;
    slug: string;
    learningArea: LearningArea;
    levels: PrimaryLevel[];
    bands: string[];
    contentDescriptionCount: number;
    elaborationCount: number;
  }>;
}
