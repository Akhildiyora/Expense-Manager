alter table expenses add column if not exists payment_mode text check (payment_mode in ('cash', 'online', 'card'));
