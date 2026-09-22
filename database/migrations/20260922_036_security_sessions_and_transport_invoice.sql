-- Security and financial consistency hardening. Safe to run repeatedly.

alter table if exists app_users
  add column if not exists session_version integer not null default 1;

-- Financial invoices can include both legs of customer transportation.
alter table if exists invoice_items
  drop constraint if exists invoice_items_source_type_check;
alter table if exists invoice_items
  add constraint invoice_items_source_type_check
  check(source_type in ('program','pre_addon','island_addon','transport_outbound','transport_return','manual'));

-- A referenced payment must belong to the same booking as the refund.
create or replace function enforce_refund_payment_booking()
returns trigger language plpgsql as $$
begin
  if new.payment_id is not null and not exists(
    select 1 from payments where payment_id=new.payment_id and booking_id=new.booking_id
  ) then
    raise exception 'Refund payment must belong to the same booking';
  end if;
  return new;
end $$;

drop trigger if exists refunds_payment_booking_match on refunds;
create trigger refunds_payment_booking_match
before insert or update of booking_id,payment_id on refunds
for each row execute function enforce_refund_payment_booking();

-- Password reset revokes all tokens issued before the reset.
create or replace function consume_password_reset(p_token_hash text,p_password_hash text)
returns uuid language plpgsql as $$
declare v_token password_reset_tokens%rowtype;
begin
  select * into v_token from password_reset_tokens
  where token_hash=p_token_hash and used_at is null and expires_at>now() for update;
  if not found then raise exception 'Invalid or expired reset token'; end if;
  update app_users set password_hash=p_password_hash,must_change_password=false,password_changed_at=now(),
    failed_login_count=0,locked_until=null,session_version=session_version+1,updated_at=now()
  where user_id=v_token.user_id;
  update password_reset_tokens set used_at=now() where reset_token_id=v_token.reset_token_id;
  return v_token.user_id;
end $$;

revoke all on function consume_password_reset(text,text) from public, anon, authenticated;
grant execute on function consume_password_reset(text,text) to service_role;
