-- Supabase Realtime filters on UPDATE events require REPLICA IDENTITY FULL.
-- Without this, column filters (e.g. clinic_id=eq.X) on UPDATE are silently
-- dropped and the client never receives the event.
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
