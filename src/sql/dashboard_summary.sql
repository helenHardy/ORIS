-- RPC: Dashboard Today Summary
-- Returns today's (America/La_Paz local day) sales KPIs for a branch (or all).
-- Cash/QR/credit split is derived from sales.payment_method text.
-- Profit uses the same real cost basis as the reports (weighted purchase cost).
create or replace function get_dashboard_summary(p_branch_id bigint default null)
returns table (
  today_sales numeric,
  today_count bigint,
  today_profit numeric,
  today_cash numeric,
  today_qr numeric,
  today_credit numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date  date   := (now() at time zone 'America/La_Paz')::date;
  v_start timestamptz := (to_char(v_date, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
  v_end   timestamptz := (to_char(v_date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
begin
  return query
  with costs as (
    select pi.product_id,
           coalesce(
             nullif(p.cost_price, 0),
             case when sum(pi.quantity) > 0 then sum(pi.unit_cost * pi.quantity) / sum(pi.quantity) end,
             0
           ) as unit_cost
    from purchase_items pi
    join products p on p.id = pi.product_id
    group by pi.product_id, p.cost_price
  ),
  item_costs as (
    select si.sale_id, sum(si.quantity * coalesce(c.unit_cost, 0)) as cost
    from sale_items si
    left join costs c on c.product_id = si.product_id
    group by si.sale_id
  ),
  base as (
    select s.id, s.total, s.subtotal, s.discount, s.payment_method, s.is_credit,
           coalesce(ic.cost, 0) as cost
    from sales s
    left join item_costs ic on ic.sale_id = s.id
    where s.created_at >= v_start and s.created_at < v_end
      and (p_branch_id is null or s.branch_id = p_branch_id)
  )
  select
    coalesce(sum(total), 0)::numeric as today_sales,
    count(*)::bigint as today_count,
    coalesce(sum(subtotal - discount - cost), 0)::numeric as today_profit,
    coalesce(sum(case
        when is_credit then 0
        when payment_method = 'Efectivo' then total
        when payment_method ilike 'Mixto%' then coalesce((regexp_match(payment_method, 'Efectivo[:=]\s*([0-9.,]+)'))[1]::numeric, 0)
        else 0 end), 0)::numeric as today_cash,
    coalesce(sum(case
        when is_credit then 0
        when payment_method = 'QR' then total
        when payment_method ilike 'Mixto%' then coalesce((regexp_match(payment_method, 'QR[:=]\s*([0-9.,]+)'))[1]::numeric, 0)
        else 0 end), 0)::numeric as today_qr,
    coalesce(sum(case when is_credit then total else 0 end), 0)::numeric as today_credit
  from base;
end;
$$;