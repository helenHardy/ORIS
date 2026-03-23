-- ========================================================
-- GACIA ERP - COMPLETE LOGIC INSTALLATION (Triggers & RPC)
-- ========================================================
-- This script installs the necessary functions for reports,
-- stock management (Kardex), and customer credit triggers.
-- ========================================================

-- 1. REPORTING FUNCTIONS (Fixes 404 in Reports page)

create or replace function get_sales_report(
  p_start_date date,
  p_end_date date,
  p_branch_id bigint default null
)
returns table (
  report_date text,
  total_sales numeric,
  total_profit numeric,
  transaction_count bigint
) as $$
begin
  return query
  with daily_sales as (
    select
      date(created_at) as d_date,
      sum(total) as d_total,
      sum(subtotal) as d_subtotal,
      sum(discount) as d_discount,
      count(id) as d_count
    from sales
    where date(created_at) >= p_start_date and date(created_at) <= p_end_date
    and (p_branch_id is null or branch_id = p_branch_id)
    group by date(created_at)
  ),
  daily_costs as (
    select
      date(s.created_at) as c_date,
      sum(si.quantity * coalesce(p.cost_price, 0)) as total_cost
    from sales s
    join sale_items si on s.id = si.sale_id
    join products p on si.product_id = p.id
    where date(s.created_at) >= p_start_date and date(s.created_at) <= p_end_date
    and (p_branch_id is null or s.branch_id = p_branch_id)
    group by date(s.created_at)
  )
  select
    to_char(ds.d_date, 'YYYY-MM-DD') as report_date,
    coalesce(ds.d_total, 0)::numeric as total_sales,
    (coalesce(ds.d_subtotal, 0) - coalesce(ds.d_discount, 0) - coalesce(dc.total_cost, 0))::numeric as total_profit,
    coalesce(ds.d_count, 0)::bigint as transaction_count
  from daily_sales ds
  left join daily_costs dc on ds.d_date = dc.c_date
  order by ds.d_date;
end;
$$ language plpgsql;

create or replace function get_top_products(
  p_start_date date,
  p_end_date date,
  p_branch_id bigint default null,
  p_limit int default 5
)
returns table (
  product_name text,
  quantity_sold numeric,
  total_revenue numeric,
  image_url text
) as $$
begin
  return query
  select
    p.name::text as product_name,
    sum(si.quantity)::numeric as quantity_sold,
    sum(si.total)::numeric as total_revenue,
    p.image_url::text
  from sale_items si
  join sales s on si.sale_id = s.id
  join products p on si.product_id = p.id
  where
    date(s.created_at) >= p_start_date
    and date(s.created_at) <= p_end_date
    and (p_branch_id is null or s.branch_id = p_branch_id)
  group by p.id, p.name, p.image_url
  order by total_revenue desc
  limit p_limit;
end;
$$ language plpgsql;

create or replace function get_inventory_valuation(
  p_branch_id bigint default null
)
returns table (
  total_cost_value numeric,
  total_retail_value numeric,
  item_count bigint
) as $$
begin
  return query
  select
    sum(pbs.stock * coalesce(p.cost_price, 0))::numeric as total_cost_value,
    sum(pbs.stock * coalesce(pbs.price, p.price, 0))::numeric as total_retail_value,
    count(distinct p.id)::bigint as item_count
  from product_branch_settings pbs
  join products p on pbs.product_id = p.id
  where
    (p_branch_id is null or pbs.branch_id = p_branch_id)
    and pbs.stock > 0;
end;
$$ language plpgsql;


-- 2. STOCK MANAGEMENT (Kardex & Triggers)

create or replace function public.update_branch_stock(
    p_product_id bigint,
    p_branch_id bigint,
    p_quantity_change numeric
) returns numeric as $$
declare
    v_new_stock numeric;
begin
    perform set_config('app.internal_stock_update', 'true', true);
    insert into public.product_branch_settings (product_id, branch_id, stock, min_stock)
    values (p_product_id, p_branch_id, p_quantity_change, 0)
    on conflict (product_id, branch_id)
    do update set stock = product_branch_settings.stock + p_quantity_change
    returning stock into v_new_stock;
    return v_new_stock;
end;
$$ language plpgsql security definer;

create or replace function public.handle_product_branch_changes()
returns trigger as $$
declare
    v_new_global_stock numeric;
    v_diff numeric;
    v_is_internal text;
begin
    select coalesce(sum(stock), 0) into v_new_global_stock
    from public.product_branch_settings
    where product_id = coalesce(new.product_id, old.product_id);

    update public.products set stock = v_new_global_stock
    where id = coalesce(new.product_id, old.product_id);

    v_is_internal := current_setting('app.internal_stock_update', true);
    if (v_is_internal is null or v_is_internal != 'true') then
        if (TG_OP = 'UPDATE') then
            v_diff := new.stock - old.stock;
            if v_diff != 0 then
                insert into public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                values (new.branch_id, new.product_id, 'AJUSTE_MANUAL', v_diff, new.stock, 'Ajuste manual de inventario');
            end if;
        elsif (TG_OP = 'INSERT') then
            if new.stock != 0 then
                insert into public.kardex (branch_id, product_id, type, quantity, balance_after, notes)
                values (new.branch_id, new.product_id, 'CARGA_INICIAL', new.stock, new.stock, 'Carga inicial de inventario');
            end if;
        end if;
    end if;
    return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_global_stock on public.product_branch_settings;
create trigger trg_sync_global_stock
after insert or update or delete on public.product_branch_settings
for each row execute function public.handle_product_branch_changes();

create or replace function public.handle_sale_item_changes()
returns trigger as $$
declare
    v_branch_id bigint;
    v_new_stock numeric;
    v_diff numeric;
begin
    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.sales where id = new.sale_id;
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'VENTA', -new.quantity, v_new_stock, new.sale_id::text, 'Venta registrada #' || new.sale_id);
    elsif (TG_OP = 'UPDATE') then
        v_diff := new.quantity - old.quantity;
        select branch_id into v_branch_id from public.sales where id = new.sale_id;
        v_new_stock := public.update_branch_stock(new.product_id, v_branch_id, -v_diff);
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, new.product_id, 'MODIFICACION_VENTA', -v_diff, v_new_stock, new.sale_id::text, 'Venta modificada #' || new.sale_id);
    elsif (TG_OP = 'DELETE') then
        select branch_id into v_branch_id from public.sales where id = old.sale_id;
        v_new_stock := public.update_branch_stock(old.product_id, v_branch_id, old.quantity);
        insert into public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
        values (v_branch_id, old.product_id, 'ANULACION_VENTA', old.quantity, v_new_stock, old.sale_id::text, 'Venta anulada #' || old.sale_id);
    end if;
    return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kardex_sale_insert_update on public.sale_items;
create trigger trg_kardex_sale_insert_update after insert or update on public.sale_items for each row execute function public.handle_sale_item_changes();
drop trigger if exists trg_kardex_sale_delete on public.sale_items;
create trigger trg_kardex_sale_delete before delete on public.sale_items for each row execute function public.handle_sale_item_changes();


-- 3. CUSTOMER CREDIT MANAGEMENT

create or replace function public.handle_sale_credit_changes()
returns trigger as $$
begin
    if (TG_OP = 'INSERT') then
        if (new.is_credit = true and new.customer_id is not null) then
            update public.customers set current_balance = coalesce(current_balance, 0) + new.total where id = new.customer_id;
        end if;
    elsif (TG_OP = 'UPDATE') then
        if (old.is_credit = true and new.is_credit = true) then
            if (old.customer_id != new.customer_id) then
                update public.customers set current_balance = coalesce(current_balance, 0) - old.total where id = old.customer_id;
                update public.customers set current_balance = coalesce(current_balance, 0) + new.total where id = new.customer_id;
            elsif (old.total != new.total) then
                update public.customers set current_balance = coalesce(current_balance, 0) + (new.total - old.total) where id = new.customer_id;
            end if;
        elsif (old.is_credit = true and new.is_credit = false) then
            update public.customers set current_balance = coalesce(current_balance, 0) - old.total where id = old.customer_id;
        elsif (old.is_credit = false and new.is_credit = true) then
            update public.customers set current_balance = coalesce(current_balance, 0) + new.total where id = new.customer_id;
        end if;
    elsif (TG_OP = 'DELETE') then
        if (old.is_credit = true and old.customer_id is not null) then
            update public.customers set current_balance = coalesce(current_balance, 0) - old.total where id = old.customer_id;
        end if;
    end if;
    return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sales_credit on public.sales;
create trigger trg_sales_credit after insert or update or delete on public.sales for each row execute function public.handle_sale_credit_changes();
