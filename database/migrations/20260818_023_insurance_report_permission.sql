-- Safe to run repeatedly. Adds a dedicated Permission Matrix key for the insurance submission report.
insert into role_permissions(role_id,permission_key,allowed,updated_at)
select role_id,'printInsuranceReport',role_id in ('admin','counter'),now()
from app_roles
on conflict(role_id,permission_key) do nothing;
