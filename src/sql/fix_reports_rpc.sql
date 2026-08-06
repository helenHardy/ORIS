-- Fix Reports RPCs
-- 1) Días de negocio en horario local (America/La_Paz) en lugar de UTC.
-- 2) Costo real derivado de compras (promedio ponderado de purchase_items.unit_cost),
--    con preferencia a products.cost_price manual si está cargado (> 0).

-- Cost basis shared by the three functions:
--   coalesce(nullif(products.cost_price, 0),
--            weighted-avg(purchase_items.unit_cost),
--            0)

create or replace function get_sales_report(p_start_date date, p_end_date date, p_branch_id bigint default null)
returns table (report_date text, total_sales numeric, total_profit numeric, transaction_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (to_char(p_start_date, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
  v_end   timestamptz := (to_char(p_end_date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
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
  daily as (
    select (s.created_at at time zone 'America/La_Paz')::date as d_date,
           sum(s.total) as d_total,
           sum(s.subtotal) as d_subtotal,
           sum(s.discount) as d_discount,
           count(*) as d_count
    from sales s
    where s.created_at >= v_start and s.created_at < v_end
      and (p_branch_id is null or s.branch_id = p_branch_id)
    group by (s.created_at at time zone 'America/La_Paz')::date
  ),
  daily_costs as (
    select (s.created_at at time zone 'America/La_Paz')::date as c_date,
           sum(ic.cost) as total_cost
    from sales s
    join item_costs ic on ic.sale_id = s.id
    where s.created_at >= v_start and s.created_at < v_end
      and (p_branch_id is null or s.branch_id = p_branch_id)
    group by (s.created_at at time zone 'America/La_Paz')::date
  )
  select to_char(ds.d_date, 'YYYY-MM-DD') as report_date,
         coalesce(ds.d_total, 0)::numeric as total_sales,
         (coalesce(ds.d_subtotal, 0) - coalesce(ds.d_discount, 0) - coalesce(dc.total_cost, 0))::numeric as total_profit,
         coalesce(ds.d_count, 0)::bigint as transaction_count
  from daily ds
  left join daily_costs dc on ds.d_date = dc.c_date
  order by ds.d_date;
end;
$$;

drop function if exists get_top_products(date, date, bigint, integer);

create or replace function get_top_products(p_start_date date, p_end_date date, p_branch_id bigint default null, p_limit integer default 10)
returns table (product_name text, quantity_sold numeric, total_revenue numeric, total_cost numeric, total_profit numeric, image_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (to_char(p_start_date, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
  v_end   timestamptz := (to_char(p_end_date + 1, 'YYYY-MM-DD') || ' 00:00:00')::timestamp at time zone 'America/La_Paz';
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
  )
  select p.name::text as product_name,
         sum(si.quantity)::numeric as quantity_sold,
         sum(si.total)::numeric as total_revenue,
         coalesce(sum(si.quantity * c.unit_cost), 0)::numeric as total_cost,
         (sum(si.total) - coalesce(sum(si.quantity * c.unit_cost), 0))::numeric as total_profit,
         p.image_url::text as image_url
  from sale_items si
  join sales s on si.sale_id = s.id
  join products p on si.product_id = p.id
  left join costs c on c.product_id = si.product_id
  where s.created_at >= v_start and s.created_at < v_end
    and (p_branch_id is null or s.branch_id = p_branch_id)
  group by p.id, p.name, p.image_url
  order by total_revenue desc
  limit p_limit;
end;
$$;

create or replace function get_inventory_valuation(p_branch_id bigint default null)
returns table (total_cost_value numeric, total_retail_value numeric, total_damaged_value numeric, item_count bigint)
language plpgsql
security definer
set search_path = public
as $$
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
  )
  select sum(pbs.stock * c.unit_cost)::numeric as total_cost_value,
         sum(pbs.stock * coalesce(pbs.price, p.price, 0))::numeric as total_retail_value,
         sum(pbs.damaged_stock * c.unit_cost)::numeric as total_damaged_value,
         count(distinct p.id)::bigint as item_count
  from product_branch_settings pbs
  join products p on pbs.product_id = p.id
  left join costs c on c.product_id = pbs.product_id
  where (p_branch_id is null or pbs.branch_id = p_branch_id)
    and (pbs.stock > 0 or pbs.damaged_stock > 0);
end;
$$;
