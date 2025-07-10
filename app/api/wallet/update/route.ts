import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for server-side operations
)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { walletAddress } = await request.json()
    if (!walletAddress) {
      return NextResponse.json({ error: 'No wallet address provided' }, { status: 400 })
    }

    console.log('API: Session user:', session.user)
    
    // Try to find user by twitter_handle first
    const currentTwitterHandle = session.user.name?.replace('@', '') || 'unknown'
    console.log('API: Looking for user with twitter_handle:', currentTwitterHandle)

    const { data: existingUser, error: findError } = await supabase
      .from('waitlist_users')
      .select('*')
      .eq('twitter_handle', currentTwitterHandle)
      .single()

    console.log('API: Found user:', existingUser, 'Error:', findError)

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update the wallet address
    const { data: updatedUser, error: updateError } = await supabase
      .from('waitlist_users')
      .update({ wallet_address: walletAddress })
      .eq('id', existingUser.id)
      .select()
      .single()

    console.log('API: Update result:', updatedUser, 'Error:', updateError)

    if (updateError) {
      console.error('API: Error updating wallet:', updateError)
      return NextResponse.json({ error: 'Failed to update wallet address' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      user: updatedUser 
    })

  } catch (error) {
    console.error('API: Error in wallet update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}