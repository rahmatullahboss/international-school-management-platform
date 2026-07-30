declare global {
  interface JsonWebKey {
    readonly kid?: string;
    readonly alg?: string;
    readonly use?: string;
  }
}

export {};
