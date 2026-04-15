// Mirrors design doc §4.2 — these are the canonical client-side shapes.

export type Role = "user" | "assistant";

export interface ProductSummary {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  brand?: string;
  rating?: number;
}

export interface Recommendation {
  top_pick: ProductSummary;
  alternatives: ProductSummary[];
  cross_sell?: string;
  message: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  products?: ProductSummary[];
  recommendation?: Recommendation | null;
  createdAt: number;
  error?: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
