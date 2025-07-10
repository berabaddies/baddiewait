import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'

interface SessionUser {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { referralCode } = await request.json()
    if (!referralCode) {
      return NextResponse.json({ error: 'No referral code provided' }, { status: 400 })
    }

    // First, find the referrer by their referral code
    const { data: referrer, error: referrerError } = await supabase
      .from('waitlist_users')
      .select('id, twitter_id, twitter_handle')
      .eq('referral_code', referralCode)
      .single()

    if (referrerError || !referrer) {
      console.error('Referrer not found:', referrerError)
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }

    // Update the current user with the referral attribution using the UUID id
    const twitterId = (session.user as SessionUser).id || session.user.email
    const twitterHandle = session.user.name?.replace('@', '') || session.user.name
    const { data: updatedUser, error: updateError } = await supabase
      .from('waitlist_users')
      .update({ referred_by: referrer.id })
      .or(`twitter_id.eq.${twitterId},twitter_handle.eq.${twitterHandle}`)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating referral attribution:', updateError)
      return NextResponse.json({ error: 'Failed to attribute referral' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      referrer: referrer.twitter_handle,
      user: updatedUser 
    })

  } catch (error) {
    console.error('Error in referral attribution:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}