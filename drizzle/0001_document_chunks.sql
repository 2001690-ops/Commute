CREATE TABLE IF NOT EXISTS attendance_chunks (
 generation TEXT NOT NULL,
 part INTEGER NOT NULL,
 payload TEXT NOT NULL,
 PRIMARY KEY (generation, part)
);
