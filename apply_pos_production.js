import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Cubase URL or Service Key missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySql(filename) {
    console.log(`--- Applying ${filename} ---`);
    const sql = fs.readFileSync(filename, 'utf8');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error(`Error applying ${filename}:`, error.message);
        return false;
    }
    console.log(`${filename} applied successfully!`);
    return true;
}

async function run() {
    const success1 = await applySql('src/sql/fix_pos_schema_production.sql');
    if (success1) {
        await applySql('src/sql/cash_flow_triggers.sql');
    }
}

run().catch(console.error);
