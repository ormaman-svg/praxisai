-- Add media columns to messages (referenced in code but missing from initial schema).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'image' | 'video' | 'audio' | 'document'
