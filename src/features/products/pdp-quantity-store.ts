import { create } from "zustand";

type PdpQuantityState = {
  quantities: Record<string, number>;
  setQuantity: (productId: string, quantity: number) => void;
};

/** Quantity picked on the mobile PDP price row; read by ProductMobileBuyBar. */
export const usePdpQuantityStore = create<PdpQuantityState>((set) => ({
  quantities: {},
  setQuantity: (productId, quantity) =>
    set((state) => ({
      quantities: { ...state.quantities, [productId]: Math.max(1, quantity) },
    })),
}));

export function usePdpQuantity(productId: string) {
  return usePdpQuantityStore((s) => s.quantities[productId] ?? 1);
}
