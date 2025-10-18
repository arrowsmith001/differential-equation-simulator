export type State = Record<string, number>;

export interface DifferentialSystem {
  variables: string[];
  fn: (state: Record<string, number>, t: number) => Record<string, number>;
}

export type Equation = {
  // null if no derivative present
  derivativeVar?: string;
  // mathjs compiled RHS (expression to evaluate)
  fn: any;
  // original expression for logging
  raw: string;
};