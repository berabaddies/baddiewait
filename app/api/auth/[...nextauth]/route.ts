import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const handler = NextAuth({
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: '2.0',
      authorization: {
        url: 'https://twitter.com/i/oauth2/authorize',
        params: {
          scope: 'tweet.read users.read'
        }
      },
      userinfo: {
        url: 'https://api.twitter.com/2/users/me',
        params: {
          'user.fields': 'public_metrics,verified,profile_image_url'
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'twitter') {
        console.log('=== FULL PROFILE STRUCTURE ===')
        console.log(JSON.stringify(profile, null, 2))
        console.log('=== CHECKING FOLLOWER ACCESS PATHS ===')
        console.log('profile?.public_metrics:', profile?.public_metrics)
        console.log('profile?.data?.public_metrics:', profile?.data?.public_metrics)
        console.log('profile?.data?.public_metrics?.followers_count:', profile?.data?.public_metrics?.followers_count)
        
        const twitterId = profile?.id || user.id
        
        // Try the correct path based on what we see in logs
        const followerCount = profile?.data?.public_metrics?.followers_count || 
                             profile?.public_metrics?.followers_count || 0
        
        console.log('Final follower count:', followerCount)
        
        const { data, error } = await supabase
          .from('waitlist_users')
          .upsert({
            twitter_id: twitterId,
            twitter_handle: profile?.username || user.name?.replace('@', '') || 'unknown',
            twitter_name: profile?.name || user.name || 'Unknown User',
            twitter_avatar: profile?.profile_image_url || user.image || '',
            follower_count: followerCount,
            is_verified: profile?.verified || false,
          }, {
            onConflict: 'twitter_id'
          })
          .select()
          .single()
    
        if (error) {
          console.error('Error storing user:', error)
          return false
        }
        
        console.log('Stored user data:', data)
      }
      return true
    },
  },
})

export { handler as GET, handler as POST }