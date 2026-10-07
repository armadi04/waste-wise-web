declare module 'graphql-depth-limit' {
  import type { ValidationRule } from 'graphql';

  /**
   * Returns a validation rule that rejects operations nested deeper than
   * `maxDepth`. (The package ships no types.)
   */
  export default function depthLimit(
    maxDepth: number,
    options?: { ignore?: Array<string | RegExp> },
    callback?: (depths: Record<string, number>) => void,
  ): ValidationRule;
}
