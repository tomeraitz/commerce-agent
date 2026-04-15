// Wire contract — mirrors design doc §4.2 + §6.

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

export interface ChatRequest {
  sessionId: string;
  message: string;
  history: Array<{ role: Role; text: string }>;
}

export interface ChatResponse {
  message: string;
  products: ProductSummary[];
  recommendation: Recommendation | null;
}

export type ChatClientErrorKind = "timeout" | "abort" | "http" | "network";

export class ChatClientError extends Error {
  readonly status: number;
  readonly kind: ChatClientErrorKind;

  constructor(args: { status: number; message: string; kind: ChatClientErrorKind }) {
    super(args.message);
    this.name = "ChatClientError";
    this.status = args.status;
    this.kind = args.kind;
  }
}
