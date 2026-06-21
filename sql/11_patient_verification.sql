-- Per-conversation identity verification state for patient self-service over WhatsApp.
-- A patient must verify (EITHER national ID OR an SMS one-time code — not both)
-- before the bot will share personal medical info or treatment history.

alter table conversations add column if not exists verified_at timestamptz;
alter table conversations add column if not exists verification_method text; -- 'national_id' | 'sms_otp'

-- One-time-code state (used only for the SMS method). The code itself is stored
-- hashed; it is short-lived and attempt-limited.
alter table conversations add column if not exists otp_hash text;
alter table conversations add column if not exists otp_expires_at timestamptz;
alter table conversations add column if not exists otp_attempts int not null default 0;
