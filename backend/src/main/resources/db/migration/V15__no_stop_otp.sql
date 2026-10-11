-- The collector no longer asks the household for a code at the door: the household confirms or disputes the payment
-- afterwards instead.
ALTER TABLE pickup_stops DROP COLUMN otp;
