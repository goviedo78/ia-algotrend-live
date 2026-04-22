const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase.from('push_subscriptions').upsert({
    endpoint: 'https://test.endpoint.com/test',
    p256dh: 'test',
    auth: 'test',
    scope: 'algotrend',
    tenant_id: 'algotrend'
  }, { onConflict: 'endpoint' })
  
  console.log("Error:", error)
  console.log("Data:", data)
}
test()
