export interface Deal {
  id: string;
  url: string;
  title: string;
  category: string;
  priceRange: string;
  rating: number;
  description: string;
  pros: string[];
  cons: string[];
  imageSearchKeyword: string;
  createdAt: string;
  isFavorite?: boolean;
  likes?: number;
  personalNotes?: string;
  customImage?: string;
}

export const CATEGORIES = [
  "אלקטרוניקה",
  "גאדג'טים",
  "טיולים ונסיעות",
  "בית ומטבח",
  "אופנה ואקססוריז",
  "צעצועים וילדים",
  "בריאות, טיפוח ויופי",
  "ספורט, קמפינג ופנאי",
  "רכב ואופנועים",
  "אחר"
] as const;

export type CategoryType = typeof CATEGORIES[number];
