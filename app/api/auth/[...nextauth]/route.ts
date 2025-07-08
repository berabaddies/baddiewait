import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Define Twitter-specific profile types
interface TwitterPublicMetrics {
  followers_count: number
  following_count: number
  tweet_count: number
  listed_count: number
}

interface TwitterProfileData {
  id: string
  username: string
  name: string
  profile_image_url: string
  verified: boolean
  public_metrics: TwitterPublicMetrics
}

interface TwitterProfile {
  id?: string
  username?: string
  name?: string
  profile_image_url?: string
  verified?: boolean
  public_metrics?: TwitterPublicMetrics
  data?: TwitterProfileData
}

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
        const twitterProfile = profile as TwitterProfile
        const twitterId = twitterProfile?.id || user.id
        
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