import {sqliteTable, integer, text, primaryKey} from 'drizzle-orm/sqlite-core';
export const store=sqliteTable('attendance_store',{id:integer('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(0)});


export const chunks=sqliteTable('attendance_chunks',{generation:text('generation').notNull(),part:integer('part').notNull(),payload:text('payload').notNull()},table=>[primaryKey({columns:[table.generation,table.part]})]);
