import { createClient } from '@supabase/supabase-js';

const check = async () => {
    const supabase = createClient('https://nlbembcnxuhbbailbouw.supabase.co', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');
    const { data, error } = await supabase.from('cash_boxes').select('*');
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Total Boxes:', data.length);
        data.forEach(box => {
            console.log(`- ID: ${box.id}, Name: ${box.name}, BranchID: ${box.branch_id}`);
        });
    }
}
check();
