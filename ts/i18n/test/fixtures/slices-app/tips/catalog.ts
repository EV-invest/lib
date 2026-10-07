// Lists every id: ignored by the table rule, or every row would be selected.
export const tips = { "wallet.x": {}, "invest.y": {} } as const;
export type TipKey = keyof typeof tips;
