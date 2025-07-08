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
        const twitterId = (profile as any)?.id || user.id
        
        // Use type assertion to access Twitter-specific properties
        const twitterProfile = profile as any
        const followerCount = twitterProfile?.data?.public_metrics?.followers_count || 
                             twitterProfile?.public_metrics?.followers_count || 0
        
        console.log('Final follower count:', followerCount)
        
        const { data, error } = await supabase
          .from('waitlist_users')
          .upsert({
            twitter_id: twitterId,
            twitter_handle: twitterProfile?.username || user.name?.replace('@', '') || 'unknown',
            twitter_name: twitterProfile?.name || user.name || 'Unknown User',
            twitter_avatar: twitterProfile?.profile_image_url || user.image || '',
            follower_count: followerCount,
            is_verified: twitterProfile?.verified || false,
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