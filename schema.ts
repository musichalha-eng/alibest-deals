import { pgTable, text, integer, real, boolean, timestamp, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const deals = pgTable('deals', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  priceRange: text('price_range').notNull(),
  rating: real('rating').notNull(),
  description: text('description').notNull(),
  pros: text('pros').array().notNull(),
  cons: text('cons').array().notNull(),
  imageSearchKeyword: text('image_search_keyword').notNull(),
  createdAt: text('created_at').notNull(),
  isFavorite: boolean('is_favorite').default(false),
  likes: integer('likes').default(0),
  personalNotes: text('personal_notes'),
  customImage: text('custom_image'),
});
