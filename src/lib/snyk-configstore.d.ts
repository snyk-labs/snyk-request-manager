declare module '@snyk/configstore' {
  class Configstore {
    constructor(id: string, defaults?: object, opts?: object);
    get(key: string): unknown;
    set(key: string, value: unknown): void;
  }
  export = Configstore;
}
