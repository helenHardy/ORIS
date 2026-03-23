import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const apply = async () => {
    const supabase = createClient('https://nlbembcnxuhbbailbouw.supabase.co', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');
    const sql = fs.readFileSync('setup_mermas.sql', 'utf8');

    console.log('--- Applying SQL for Mermas System ---');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    // Note: 'exec_sql' RPC might not exist. If it doesn't, we'll try a different approach or inform the user.
    // In many Supabase setups, there is a helper RPC to run SQL for migrations if enabled.

    if (error) {
        console.error('Error applying SQL:', error.message);
        if (error.message.includes('function "exec_sql" does not exist')) {
            console.log('\n[IMPORTANT] La función RPC "exec_sql" no está disponible. Por favor, copia el contenido de "setup_mermas.sql" y ejecútalo manualmente en el Editor SQL de Supabase.');
        }
    } else {
        console.log('SQL applied successfully!');
    }
}

apply().catch(console.error);
