export type Quote = {
  valid: boolean;
  priced: boolean;
  list: number;
  discount: number;
  due: number;
  label: string | null;
};

export const money = (n: number) => `GHS ${Number.isInteger(n) ? n : n.toFixed(2)}`;
