import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatorDashboard } from '@/components/dashboard/CreatorDashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: streams } = await supabase
    .from('streams')
    .select('*')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: stats } = await supabase
    .from('streams')
    .select('viewer_count, peak_viewers')
    .eq('host_id', user.id)
    .eq('status', 'ended')

  const totalViews = stats?.reduce((sum, s) => sum + (s.peak_viewers || 0), 0) ?? 0

  return (
    <CreatorDashboard
      profile={profile}
      recentStreams={streams ?? []}
      totalViews={totalViews}
    />
  )
}
