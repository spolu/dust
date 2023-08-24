export type DatasetType = "MATH" | "Krypto4";

export type ProblemId = string;

export type Example = {
  id: ProblemId;
  question: string;
  reasoning: string;
  answer: string;
};

export type Test = {
  id: ProblemId;
  question: string;
  answer: string;
};

export abstract class Dataset {
  abstract readonly name: DatasetType;

  abstract instructions(): string;

  abstract tests({ count }: { count: number }): Test[];

  abstract examples({
    problem,
    count,
  }: {
    problem: ProblemId;
    count: number;
  }): Example[];
}
