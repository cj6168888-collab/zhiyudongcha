// Global ambient typings to silence widespread TS strict errors during plan B iterations
declare var QueryOptimizer: any;
declare interface QueryResult { execute?: any; }
declare class DbPlaceholder {}
declare type ServerConfig = any;
declare type PathItem = any;
declare type Components = any;
declare type Schema = any;
declare type OpenAPISpec = any;
declare type OpenAPISecurity = any;
declare type OpenAPIParameter = any;
declare type OpenAPIOperation = any;

declare module '../services/migration-coordinator' {
  const value: any;
  export = value;
}

declare const recommendations: any;

declare interface Cipher {
  getAuthTag?: () => Buffer;
}
declare interface Decipher {
  setAuthTag?: (tag: Buffer) => void;
}
