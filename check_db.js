import { createClient } from '@supabase/supabase-js';

const check = async () => {
    const supabase = createClient('https://nlbembcnxuhbbailbouw.supabase.co', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');

    console.log('--- 1. Testing Connection (products table) ---');
    const { data: pData, error: pError } = await supabase.from('products').select('id').limit(1);
    if (pError) console.error('Products Error:', pError.message);
    else console.log('Products Check: OK');

    console.log('\n--- 2. Testing cash_boxes table ---');
    const { data: cbData, error: cbError } = await supabase.from('cash_boxes').select('id').limit(1);
    if (cbError) console.error('Cash Boxes Error:', cbError.message);
    else console.log('Cash Boxes Check: OK');

    console.log('\n--- 3. Testing cash_movements table ---');
    const { data: cmData, error: cmError } = await supabase.from('cash_movements').select('id').limit(1);
    if (cmError) console.error('Cash Movements Error:', cmError.message);
    else console.log('Cash Movements Check: OK');

    console.log('\n--- 4. Testing cash_box_id column in customer_payments ---');
    const { data: cpData, error: cpError } = await supabase.from('customer_payments').select('cash_box_id').limit(1);
    if (cpError) console.error('Customer Payments Column Error:', cpError.message);
    else console.log('Customer Payments Column Check: OK');
}

check().catch(console.error);
