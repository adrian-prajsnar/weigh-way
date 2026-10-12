-- Revoke default PUBLIC execute on account deletion RPC (defense in depth).
-- Safe to re-run: GRANT to authenticated is idempotent.

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;

grant execute on function public.delete_own_account() to authenticated;
