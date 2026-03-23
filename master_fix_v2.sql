-- ========================================================
-- GACIA ERP - MASTER FIX V2 (PRO)
-- ========================================================
-- Incluye Reportes, Triggers (Ventas, Compras, Traspasos)
-- y Sincronización Completa de Stock.
-- ========================================================

-- 1. FUNCIONES Y GATILLOS (Instalación Limpia)

-- Función Auxiliar de Stock
create or replace function public.update_branch_stock(p_product_id bigint, p_branch_id bigint, p_quantity_change numeric) returns numeric as $$
declare v_new_stock numeric;
begin
    insert into public.product_branch_settings (product_id, branch_id, stock, min_stock)
    values (p_product_id, p_branch_id, p_quantity_change, 0)
    on conflict (product_id, branch_id)
    do update set stock = product_branch_settings.stock + p_quantity_change
    returning stock into v_new_stock;
    return v_new_stock;
end; $$ language plpgsql security definer;

-- Gatillo de COMPRAS
create or replace function public.handle_purchase_delete() returns trigger as $$
declare t_item record; v_new_stock numeric;
begin
    for t_item in select * from public.purchase_items where purchase_id = old.id loop
        v_new_stock := public.update_branch_stock(t_item.product_id, old.branch_id, -t_item.quantity);
    end loop; return old;
end; $$ language plpgsql security definer;

drop trigger if exists trg_purchase_delete_stock on public.purchases;
create trigger trg_purchase_delete_stock before delete on public.purchases for each row execute function public.handle_purchase_delete();

create or replace function public.handle_purchase_item_changes() returns trigger as $$
declare v_branch_id bigint;
begin
    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.purchases where id = new.purchase_id;
        perform public.update_branch_stock(new.product_id, v_branch_id, new.quantity);
    end if; return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_kardex_purchase_insert_update on public.purchase_items;
create trigger trg_kardex_purchase_insert_update after insert on public.purchase_items for each row execute function public.handle_purchase_item_changes();

-- Gatillo de VENTAS
create or replace function public.handle_sale_delete() returns trigger as $$
declare t_item record;
begin
    for t_item in select * from public.sale_items where sale_id = old.id loop
        perform public.update_branch_stock(t_item.product_id, old.branch_id, t_item.quantity);
    end loop; return old;
end; $$ language plpgsql security definer;

drop trigger if exists trg_sale_delete_stock on public.sales;
create trigger trg_sale_delete_stock before delete on public.sales for each row execute function public.handle_sale_delete();

create or replace function public.handle_sale_item_changes() returns trigger as $$
declare v_branch_id bigint;
begin
    if (TG_OP = 'INSERT') then
        select branch_id into v_branch_id from public.sales where id = new.sale_id;
        perform public.update_branch_stock(new.product_id, v_branch_id, -new.quantity);
    end if; return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_kardex_sale_insert_update on public.sale_items;
create trigger trg_kardex_sale_insert_update after insert on public.sale_items for each row execute function public.handle_sale_item_changes();

-- Gatillo de TRASPASOS (¡Fundamental!)
create or replace function public.handle_transfer_status_changes() returns trigger as $$
declare t_item record; v_origin_stock numeric; v_dest_stock numeric;
begin
    -- Enviado: Descuenta de Origen
    if (new.status = 'Enviado' and (old.status = 'Pendiente' or old.status is null)) then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            perform public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
        end loop;
    -- Recibido: Suma a Destino (si viene de Enviado)
    elsif (new.status = 'Recibido' and old.status = 'Enviado') then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            perform public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
        end loop;
    -- Recibido Directo (Pendiente -> Recibido)
    elsif (new.status = 'Recibido' and (old.status = 'Pendiente' or old.status is null)) then
        for t_item in select * from public.transfer_items where transfer_id = new.id loop
            perform public.update_branch_stock(t_item.product_id, new.origin_branch_id, -t_item.quantity);
            perform public.update_branch_stock(t_item.product_id, new.destination_branch_id, t_item.quantity);
        end loop;
    end if; return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_kardex_transfer on public.transfers;
create trigger trg_kardex_transfer after update on public.transfers for each row execute function public.handle_transfer_status_changes();


-- 2. REPARACIÓN TOTAL DE STOCK

UPDATE public.product_branch_settings SET stock = 0;

DO $$
DECLARE itm RECORD;
BEGIN
    -- Compras
    FOR itm IN SELECT pi.product_id, pi.quantity, p.branch_id FROM public.purchase_items pi JOIN public.purchases p ON pi.purchase_id = p.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, itm.quantity);
    END LOOP;
    -- Ventas
    FOR itm IN SELECT si.product_id, si.quantity, s.branch_id FROM public.sale_items si JOIN public.sales s ON si.sale_id = s.id LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.branch_id, -itm.quantity);
    END LOOP;
    -- Traspasos (Solo los que están Recibidos)
    FOR itm IN SELECT ti.product_id, ti.quantity, t.origin_branch_id, t.destination_branch_id FROM public.transfer_items ti JOIN public.transfers t ON ti.transfer_id = t.id WHERE t.status = 'Recibido' OR t.status = 'Completado' LOOP
        PERFORM public.update_branch_stock(itm.product_id, itm.origin_branch_id, -itm.quantity);
        PERFORM public.update_branch_stock(itm.product_id, itm.destination_branch_id, itm.quantity);
    END LOOP;
END $$;

-- Sincronizar Global
UPDATE public.products p SET stock = (SELECT COALESCE(SUM(stock), 0) FROM public.product_branch_settings s WHERE s.product_id = p.id);
