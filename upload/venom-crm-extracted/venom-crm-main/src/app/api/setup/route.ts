import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminAvailable, createAuthenticatedClient } from '@/lib/supabase-admin'

// ===== Index SQL Definitions =====
const INDEX_SQL_STATEMENTS = [
  'CREATE INDEX IF NOT EXISTS idx_leads_is_archived ON leads(is_archived);',
  'CREATE INDEX IF NOT EXISTS idx_leads_tele_name ON leads(tele_name);',
  'CREATE INDEX IF NOT EXISTS idx_leads_sales_name ON leads(sales_name);',
  'CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);',
  'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);',
  'CREATE INDEX IF NOT EXISTS idx_leads_sales_status ON leads(sales_status);',
  'CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON leads(archived_at);',
  'CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);',
  'CREATE INDEX IF NOT EXISTS idx_leads_attended ON leads(attended);',
  '-- Composite index for common query pattern: active leads for a specific tele person',
  'CREATE INDEX IF NOT EXISTS idx_leads_tele_active ON leads(tele_name, is_archived);',
  '-- Composite index for common query pattern: active leads for a specific sales person',
  'CREATE INDEX IF NOT EXISTS idx_leads_sales_active ON leads(sales_name, is_archived);',
] as const

/**
 * Full SQL script that creates a helper Postgres function AND the indexes.
 * The function can be called via supabase.rpc('setup_crm_indexes').
 */
const FULL_SETUP_SQL = `-- Step 1: Create a helper function that creates all CRM indexes
-- Run this entire script in the Supabase SQL Editor (Dashboard > SQL Editor)
-- After running, you can call the function from the API: supabase.rpc('setup_crm_indexes')

CREATE OR REPLACE FUNCTION setup_crm_indexes()
RETURNS TABLE(index_name text, status text) AS $$
DECLARE
  idx_name text;
  idx_sql text;
BEGIN
  -- idx_leads_is_archived
  idx_name := 'idx_leads_is_archived';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_is_archived ON leads(is_archived)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_tele_name
  idx_name := 'idx_leads_tele_name';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_tele_name ON leads(tele_name)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_sales_name
  idx_name := 'idx_leads_sales_name';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_sales_name ON leads(sales_name)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_phone
  idx_name := 'idx_leads_phone';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_created_at
  idx_name := 'idx_leads_created_at';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_status
  idx_name := 'idx_leads_status';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_sales_status
  idx_name := 'idx_leads_sales_status';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_sales_status ON leads(sales_status)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_archived_at
  idx_name := 'idx_leads_archived_at';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON leads(archived_at)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_lead_notes_lead_id
  idx_name := 'idx_lead_notes_lead_id';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- idx_leads_attended
  idx_name := 'idx_leads_attended';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_attended ON leads(attended)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- Composite: active leads for a specific tele person
  idx_name := 'idx_leads_tele_active';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_tele_active ON leads(tele_name, is_archived)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  -- Composite: active leads for a specific sales person
  idx_name := 'idx_leads_sales_active';
  idx_sql  := 'CREATE INDEX IF NOT EXISTS idx_leads_sales_active ON leads(sales_name, is_archived)';
  EXECUTE idx_sql;
  index_name := idx_name; status := 'created'; RETURN NEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Call the function to create all indexes immediately
SELECT * FROM setup_crm_indexes();
`

/**
 * Plain SQL with just the index CREATE statements (no function wrapper).
 * Use this if you prefer running the statements directly.
 */
const PLAIN_INDEX_SQL = INDEX_SQL_STATEMENTS.join('\n')

/**
 * SQL to check which indexes already exist on the leads / lead_notes tables.
 */
const CHECK_INDEXES_SQL = `SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('leads', 'lead_notes')
ORDER BY tablename, indexname;`

/**
 * SQL to create the get_duplicate_phones() PostgreSQL function.
 *
 * This function does all the duplicate detection work server-side in SQL,
 * which is dramatically faster than loading all leads into JS memory.
 * Called by the /api/duplicates endpoint via supabase.rpc('get_duplicate_phones').
 *
 * To install manually, run this SQL in the Supabase Dashboard SQL Editor.
 */
const CREATE_DUPLICATE_FUNCTION_SQL = `-- Creates PostgreSQL functions for fast server-side duplicate detection.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- After running, /api/duplicates will automatically use it for 10-100x faster responses.

-- Step 1: Phone normalization function (mirrors the JS normalizePhone logic)
CREATE OR REPLACE FUNCTION normalize_phone(input_phone text)
RETURNS text AS $$
DECLARE
  p text;
BEGIN
  IF input_phone IS NULL OR input_phone = '' THEN RETURN ''; END IF;

  -- Remove spaces, hyphens, parentheses
  p := REGEXP_REPLACE(input_phone, '[\\s\\-()]', '', 'g');

  -- Saudi number normalization
  IF p LIKE '+966%' THEN RETURN p;
  ELSIF p LIKE '00966%' THEN RETURN '+' || SUBSTRING(p FROM 3);
  ELSIF p LIKE '966%' THEN RETURN '+' || p;
  ELSIF p LIKE '05%' AND LENGTH(p) >= 10 THEN RETURN '+966' || SUBSTRING(p FROM 2);
  ELSIF p LIKE '5%' AND LENGTH(p) >= 9 THEN RETURN '+966' || p;
  ELSE RETURN p;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Duplicate detection function that groups by NORMALIZED phone
CREATE OR REPLACE FUNCTION get_duplicate_phones()
RETURNS TABLE(phone text, lead_ids bigint[], tele_names text[], sales_names text[]) AS $$
  SELECT
    normalize_phone(leads.phone) as phone,
    array_agg(id ORDER BY id) as lead_ids,
    array_agg(COALESCE(tele_name, '') ORDER BY id) as tele_names,
    array_agg(COALESCE(sales_name, '') ORDER BY id) as sales_names
  FROM leads
  WHERE is_archived = false AND phone IS NOT NULL AND phone != ''
  GROUP BY normalize_phone(leads.phone)
  HAVING COUNT(*) > 1
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 3: Check if a specific phone exists in the database (for pre-insert duplicate detection)
CREATE OR REPLACE FUNCTION check_phone_duplicate(input_phone text, exclude_id bigint DEFAULT NULL)
RETURNS TABLE(id bigint, phone text, tele_name text, sales_name text) AS $$
  SELECT l.id, l.phone, l.tele_name, l.sales_name
  FROM leads l
  WHERE l.is_archived = false
    AND normalize_phone(l.phone) = normalize_phone(input_phone)
    AND (exclude_id IS NULL OR l.id != exclude_id)
  ORDER BY l.id
  LIMIT 5;
$$ LANGUAGE sql SECURITY DEFINER;`

/**
 * Setup & health check API route.
 * Used by the RlsSetupBanner to check if write operations work,
 * and by the admin panel to create database indexes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    if (action === 'check-rls') {
      const adminAvailable = isAdminAvailable()
      const authToken = request.headers.get('X-Supabase-Auth') || undefined

      // Try to check if write operations work
      // We'll attempt a lightweight read + check if service role is available
      let working = false
      let mode = 'none'
      let details = ''

      if (adminAvailable) {
        const admin = getSupabaseAdmin()!
        // Test read access
        const { error: readErr } = await admin
          .from('leads')
          .select('id')
          .limit(1)
        if (readErr) {
          details = `Admin read failed: ${readErr.message}`
        } else {
          working = true
          mode = 'admin'
        }
      } else if (authToken) {
        // Try with authenticated client
        const client = createAuthenticatedClient(authToken)
        const { error: readErr } = await client
          .from('leads')
          .select('id')
          .limit(1)
        if (readErr) {
          details = `Authenticated read failed: ${readErr.message}`
        } else {
          // Read works, try a test insert (we'll delete it immediately)
          const testId = `rls_test_${Date.now()}`
          const { data: insertData, error: insertErr } = await client
            .from('leads')
            .insert({
              store_url: testId,
              phone: '__rls_test__',
              status: 'new',
              tele_name: '__test__',
            })
            .select()
            .single()
          if (insertErr) {
            details = `Read OK but INSERT failed: ${insertErr.message}`
            mode = 'read-only'
          } else {
            // Clean up the test row
            if (insertData?.id) {
              await client.from('leads').delete().eq('id', insertData.id)
            }
            working = true
            mode = 'authenticated'
          }
        }
      } else {
        details = 'No service role key or auth token available'
      }

      return NextResponse.json({
        working,
        mode,
        details,
        adminAvailable,
      })
    }

    if (action === 'create-indexes') {
      const admin = getSupabaseAdmin()
      if (!admin) {
        return NextResponse.json({
          success: false,
          error: 'Supabase admin client not available. Set SUPABASE_SERVICE_ROLE_KEY.',
          sql: PLAIN_INDEX_SQL,
          fullSetupSql: FULL_SETUP_SQL,
          instructions: 'Run the SQL below in the Supabase SQL Editor (Dashboard > SQL Editor).',
        }, { status: 400 })
      }

      // Attempt to call the setup_crm_indexes RPC function
      const { data, error } = await admin.rpc('setup_crm_indexes')

      if (error) {
        // The RPC function likely doesn't exist yet
        const isMissingFunction = /could not find.*function|does not exist|not found/i.test(error.message)

        return NextResponse.json({
          success: false,
          error: error.message,
          rpcAvailable: false,
          needsManualSetup: true,
          sql: PLAIN_INDEX_SQL,
          fullSetupSql: FULL_SETUP_SQL,
          checkIndexesSql: CHECK_INDEXES_SQL,
          instructions: isMissingFunction
            ? 'The setup_crm_indexes() function does not exist in your Supabase database. Run the fullSetupSql below in the Supabase SQL Editor (Dashboard > SQL Editor) to create the function AND all indexes in one step. After that, the API endpoint will work for future index updates.'
            : `Error calling setup_crm_indexes(): ${error.message}. Try running the SQL manually in the Supabase SQL Editor.`,
        }, { status: 200 }) // Return 200 so the client can still read the SQL
      }

      // RPC succeeded — indexes were created
      return NextResponse.json({
        success: true,
        rpcAvailable: true,
        results: data,
        message: 'All indexes created successfully via setup_crm_indexes() RPC.',
      })
    }

    if (action === 'get-index-sql') {
      // Just return the SQL without trying to execute it
      return NextResponse.json({
        sql: PLAIN_INDEX_SQL,
        fullSetupSql: FULL_SETUP_SQL,
        checkIndexesSql: CHECK_INDEXES_SQL,
        indexes: INDEX_SQL_STATEMENTS.map((stmt) => {
          const match = stmt.match(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+)\(([^)]+)\)/)
          return match
            ? { name: match[1], table: match[2], columns: match[3], sql: stmt }
            : { name: null, table: null, columns: null, sql: stmt }
        }),
        instructions: 'Run fullSetupSql in the Supabase SQL Editor to create the helper function AND indexes. Or run sql directly for just the index statements.',
      })
    }

    if (action === 'check-duplicate-function') {
      // Check if the get_duplicate_phones() PostgreSQL function exists
      // by trying to call it via RPC
      const admin = getSupabaseAdmin()
      const authToken = request.headers.get('X-Supabase-Auth') || undefined
      let client = admin

      if (!client && authToken) {
        client = createAuthenticatedClient(authToken)
      }

      if (!client) {
        return NextResponse.json({
          available: false,
          message: 'No Supabase client available to check RPC function',
          setupSQL: CREATE_DUPLICATE_FUNCTION_SQL.trim(),
          instructions: 'Run the setupSQL in the Supabase SQL Editor to enable fast duplicate detection.',
        })
      }

      // Try calling the RPC function
      const { error } = await client.rpc('get_duplicate_phones')
      if (error) {
        return NextResponse.json({
          available: false,
          message: `RPC function not available: ${error.message}`,
          setupSQL: CREATE_DUPLICATE_FUNCTION_SQL.trim(),
          instructions: 'Run the setupSQL in the Supabase SQL Editor to enable fast duplicate detection. The /api/duplicates endpoint will fall back to a slower JS-based approach.',
        })
      }

      return NextResponse.json({
        available: true,
        message: 'get_duplicate_phones() RPC function is available — duplicate detection is optimized!',
      })
    }

    if (action === 'get-duplicate-function-sql') {
      // Return the SQL needed to create the duplicate detection function (for manual setup)
      return NextResponse.json({
        sql: CREATE_DUPLICATE_FUNCTION_SQL.trim(),
        instructions: 'Run this SQL in the Supabase Dashboard SQL Editor to enable fast server-side duplicate detection. After creating the function, the /api/duplicates endpoint will automatically use it instead of loading all leads into memory.',
      })
    }

    if (action === 'enable-realtime') {
      // Try to enable Realtime on the leads and lead_notes tables
      const admin = getSupabaseAdmin()
      if (!admin) {
        return NextResponse.json({
          success: false,
          error: 'Supabase admin client not available. Set SUPABASE_SERVICE_ROLE_KEY.',
          sql: `-- Run this SQL in the Supabase SQL Editor to enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;`,
          instructions: 'Run the SQL above in the Supabase SQL Editor, or enable Realtime manually in the Dashboard: Database > Replication > select leads and lead_notes tables.',
        }, { status: 400 })
      }

      // Try to enable Realtime using SQL via RPC
      try {
        // First check if the tables are already in the publication
        const { data: checkData, error: checkError } = await admin
          .rpc('exec_sql', { query: "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'" })
          .catch(() => ({ data: null, error: new Error('RPC not available') }))

        // Try adding tables to Realtime publication
        const results: string[] = []
        
        for (const table of ['leads', 'lead_notes']) {
          try {
            await admin.rpc('exec_sql', { 
              query: `ALTER PUBLICATION supabase_realtime ADD TABLE ${table}` 
            })
            results.push(`${table}: added to realtime`)
          } catch {
            // Table might already be in the publication
            results.push(`${table}: already in realtime or error adding`)
          }
        }

        return NextResponse.json({
          success: true,
          results,
          checkData,
          checkError: checkError?.message,
          manualSql: `-- Run this SQL in the Supabase SQL Editor to enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;`,
          instructions: 'If the automatic setup failed, run the manualSql above in the Supabase SQL Editor.',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return NextResponse.json({
          success: false,
          error: message,
          manualSql: `-- Run this SQL in the Supabase SQL Editor to enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE lead_notes;`,
          instructions: 'Run the SQL above in the Supabase SQL Editor, or enable Realtime manually in the Dashboard: Database > Replication > select leads and lead_notes tables.',
        })
      }
    }

    if (action === 'check-realtime') {
      // Check if Realtime is enabled on the leads and lead_notes tables
      // by trying to add them (if already added, we get "already member" error which means it's enabled)
      const admin = getSupabaseAdmin()
      if (!admin) {
        return NextResponse.json({
          available: false,
          mode: 'no-admin',
          tables: [],
          instructions: 'Set SUPABASE_SERVICE_ROLE_KEY to check Realtime status, or check manually in Supabase Dashboard > Database > Replication.',
        })
      }

      try {
        const tables: string[] = []

        for (const table of ['leads', 'lead_notes']) {
          try {
            // Try to add the table - if it's already a member, we get error 42710
            // which actually means realtime IS enabled for this table
            await admin.rpc('exec_sql', {
              query: `ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`
            })
            // If we get here without error, the table was just added
            tables.push(table)
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            // Error 42710 = "already member" = realtime is already enabled ✅
            if (errMsg.includes('already member') || errMsg.includes('42710')) {
              tables.push(table)
            }
            // Other errors: might not have permission, but that's OK
          }
        }

        return NextResponse.json({
          available: tables.length > 0,
          tables,
          instructions: tables.length > 0
            ? `Realtime مفعّل على: ${tables.join(', ')} ✅`
            : 'Go to Supabase Dashboard > Database > Replication to enable Realtime for leads and lead_notes tables.',
        })
      } catch (err) {
        return NextResponse.json({
          available: false,
          tables: [],
          error: err instanceof Error ? err.message : String(err),
          instructions: 'Check Supabase Dashboard > Database > Replication to verify Realtime is enabled for leads and lead_notes tables.',
        })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[api/setup] Error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message, working: false, mode: 'none' }, { status: 500 })
  }
}

/**
 * GET /api/setup?action=create-indexes|get-index-sql
 * Read-only variant that returns SQL without executing anything.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'get-index-sql' || action === 'get-duplicate-function-sql' || !action) {
    return NextResponse.json({
      sql: PLAIN_INDEX_SQL,
      fullSetupSql: FULL_SETUP_SQL,
      checkIndexesSql: CHECK_INDEXES_SQL,
      duplicateFunctionSql: CREATE_DUPLICATE_FUNCTION_SQL.trim(),
      indexes: INDEX_SQL_STATEMENTS.map((stmt) => {
        const match = stmt.match(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+)\(([^)]+)\)/)
        return match
          ? { name: match[1], table: match[2], columns: match[3], sql: stmt }
          : { name: null, table: null, columns: null, sql: stmt }
      }),
      instructions: 'Run fullSetupSql in the Supabase SQL Editor to create the helper function AND indexes. Run duplicateFunctionSql to enable fast server-side duplicate detection.',
    })
  }

  if (action === 'check-indexes') {
    // Try to query existing indexes via the check function
    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json({
        error: 'Admin client not available',
        checkIndexesSql: CHECK_INDEXES_SQL,
        instructions: 'Run the checkIndexesSql in Supabase SQL Editor to see existing indexes.',
      }, { status: 400 })
    }

    const { data, error } = await admin.rpc('check_crm_indexes')

    if (error) {
      return NextResponse.json({
        error: error.message,
        checkIndexesSql: CHECK_INDEXES_SQL,
        instructions: 'Run the checkIndexesSql in Supabase SQL Editor to see existing indexes. The check_crm_indexes() RPC function is not available yet.',
      })
    }

    return NextResponse.json({
      indexes: data,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
