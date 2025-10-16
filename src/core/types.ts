export interface DifferentialSystem {
  variables: string[];
  fn: (state: Record<string, number>, t: number) => Record<string, number>;
}
