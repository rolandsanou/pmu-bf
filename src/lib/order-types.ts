export type NewOrderItem = {
  offerId: string;
  selections: number[];
};

export type NewOrderInput = {
  customerName: string;
  customerPhone: string;
  paymentNetwork: "ORANGE" | "MOOV";
  paymentPhone: string;
  paymentRef: string;
  items: NewOrderItem[];
};

export type CreateOrderResult =
  | { ok: true; code: string }
  | { ok: false; error: string };
