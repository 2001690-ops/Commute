import {sqliteTable, integer, text} from 'drizzle-orm/sqlite-core';
export const store=sqliteTable('attendance_store',{id:integer('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(0)});
