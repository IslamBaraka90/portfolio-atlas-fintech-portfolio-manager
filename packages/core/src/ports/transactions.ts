export interface Transactions {
  run<T>(work: () => T): T;
}
export const directTransactions: Transactions = { run: (work) => work() };
