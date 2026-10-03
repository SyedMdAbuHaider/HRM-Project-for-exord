declare global {
  interface ObjectConstructor {
    entries(o: any): [string, any][];
    values(o: any): any[];
  }
}
export {};
