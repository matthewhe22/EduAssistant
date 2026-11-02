/**
 * Types for the Victorian Curriculum F–10 Version 2.0 dataset (Foundation to Level 6).
 *
 * Source: Victorian Curriculum and Assessment Authority (VCAA).
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
  /** Sub-strand heading where the curriculum has one, e.g. "Phonics and word knowledge". */
  subStrand?: string;
  /** Verbatim content description text (fractions rendered as a/b). */
  text: string;
}

export interface SubjectLevel {
  level: PrimaryLevel;
  levelDescription: string;
  achievementStandard: string;
  contentDescriptions: ContentDescription[];
}

export interface SubjectCurriculum {
  /** Subject name as VCAA titles it, without the "Version 2.0" suffix, e.g. "Mathematics", "Visual Arts". */
  subject: string;
  slug: string;
  learningArea: LearningArea;
  /** VCAA domain filter code used to fetch the subject, e.g. "M2". */
  domainCode: string;
  source: string;
  retrievedAt: string;
  levels: SubjectLevel[];
}

export interface CurriculumIndex {
  version: "Victorian Curriculum F–10 Version 2.0";
  retrievedAt: string;
  subjects: Array<{
    subject: string;
    slug: string;
    learningArea: LearningArea;
    levels: PrimaryLevel[];
    contentDescriptionCount: number;
  }>;
}
