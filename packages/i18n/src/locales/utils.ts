/** Recursively widen `as const` string literals to `string` for locale bundles. */
export type Localized<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends object
      ? Localized<T[K]>
      : string;
};
