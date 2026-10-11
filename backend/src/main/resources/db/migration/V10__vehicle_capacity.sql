-- How many kilograms one trip can carry. NULL means "the usual capacity of the vehicle type".
ALTER TABLE collectors ADD COLUMN vehicle_capacity_kg NUMERIC(8, 1);
