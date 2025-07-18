'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { createClient } from '@supabase/supabase-js'
import { Users, Trophy, Wallet, ExternalLink, CheckCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface WaitlistUser {
  id: string
  twitter_handle: string
  twitter_name: string
  twitter_avatar: string
  follower_count: number
  is_verified: boolean
  wallet_address?: string
  created_at: string
}

interface SessionUser {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function WaitlistApp() {
  const { data: session, status } = useSession()
  const [showWalletStep, setShowWalletStep] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [waitlistMembers, setWaitlistMembers] = useState<WaitlistUser[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [recentSignups, setRecentSignups] = useState(0)
  const [userStatus, setUserStatus] = useState<'checking' | 'new' | 'existing' | 'unknown'>('checking')
  const [userReferralCode, setUserReferralCode] = useState('')
  const [incomingReferralCode, setIncomingReferralCode] = useState('')

  // Add this debug logging right after your useState declarations
console.log('🔍 Component state:', { 
  status, 
  hasSession: !!session?.user, 
  userStatus, 
  showWalletStep, 
  isSubmitted 
})

  // Check for incoming referral code on component mount
  useEffect(() => {
    // First check sessionStorage
    const referralCode = sessionStorage.getItem('referralCode')
    if (referralCode) {
      setIncomingReferralCode(referralCode)
    }
    
    // Also check URL parameters (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search)
    const urlReferralCode = urlParams.get('ref')
    if (urlReferralCode) {
      setIncomingReferralCode(urlReferralCode)
      sessionStorage.setItem('referralCode', urlReferralCode)
    }
  }, [])

  // Fetch waitlist members (sorted by follower count)
  useEffect(() => {
    fetchWaitlistMembers()
    fetchStats()
  }, [])

  const fetchWaitlistMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('waitlist_users')
        .select('*')
        .order('follower_count', { ascending: false })
        .limit(10)
  
      if (error) {
        console.error('Error fetching waitlist:', error)
        return
      }
  
      if (data) {
        setWaitlistMembers(data)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const { count } = await supabase
        .from('waitlist_users')
        .select('*', { count: 'exact', head: true })
  
      if (count) {
        setTotalUsers(count)
      }
  
      // Get recent signups (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentCount } = await supabase
        .from('waitlist_users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo)
  
      if (recentCount) {
        setRecentSignups(recentCount)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const handleWalletSubmit = async () => {
    if (!session?.user) return
  
    console.log('Submitting wallet address via API:', walletAddress)
    
    try {
      const response = await fetch('/api/wallet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      })
      
      const result = await response.json()
      console.log('API response:', result)
      
      if (response.ok && result.success) {
        console.log('Successfully updated wallet!')
        setIsSubmitted(true)
        fetchWaitlistMembers()
      } else {
        console.error('Failed to update wallet:', result.error)
      }
    } catch (error) {
      console.error('Error calling wallet API:', error)
    }
  }

  const handleSkipWallet = () => {
    setIsSubmitted(true)
    fetchWaitlistMembers() // Refresh the list
  }

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }

  const checkUserStatus = useCallback(async () => {
    if (!session?.user) return
  
    try {
      const twitterId = (session.user as SessionUser).id || session.user.email
      const twitterHandle = session.user.name?.replace('@', '') || session.user.name
      
      const { data } = await supabase
        .from('waitlist_users')
        .select('wallet_address, id, referred_by')
        .or(`twitter_id.eq.${twitterId},twitter_handle.eq.${twitterHandle}`)
        .single()
  
      console.log('User check result:', data)
      
      // Handle referral attribution if user is new and has a referral code
      if (incomingReferralCode && !data?.referred_by) {
        console.log('Attributing referral to user:', incomingReferralCode)
        try {
          const response = await fetch('/api/referral/attribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: incomingReferralCode })
          })
          
          if (response.ok) {
            const result = await response.json()
            console.log('Referral attributed successfully:', result)
            sessionStorage.removeItem('referralCode') // Clean up
          }
        } catch (error) {
          console.error('Error attributing referral:', error)
        }
      }
      
      // Check if user exists AND has completed the full flow
      if (data && data.wallet_address !== null) {
        // User has completed everything including wallet step
        console.log('Existing user who completed wallet step')
        setUserStatus('existing')
      } else if (data && data.wallet_address === null) {
        // User exists but hasn't done wallet step yet
        console.log('User exists but needs wallet step')
        setUserStatus('new')
      } else {
        console.log('Completely new user')
        setUserStatus('new')
      }
    } catch {
      console.log('User not found, treating as new')
      setUserStatus('new')
    }
  }, [session?.user, incomingReferralCode])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      checkUserStatus()
    } else if (status === 'unauthenticated') {
      setUserStatus('unknown')
    }
  }, [status, session, checkUserStatus])
  
// Add this additional useEffect to handle the wallet step
useEffect(() => {
  const wasJustAuthenticated = sessionStorage.getItem('justAuthenticated') === 'true'
  console.log('🔍 Wallet useEffect triggered:', { userStatus, hasSession: !!session?.user, isSubmitted, wasJustAuthenticated })
  
  if (userStatus === 'new' && session?.user && !isSubmitted && wasJustAuthenticated) {
    console.log('✅ Showing wallet step!')
    setShowWalletStep(true)
    sessionStorage.removeItem('justAuthenticated') // Clear the flag
  }
}, [userStatus, session, isSubmitted])

  useEffect(() => {
    const fetchReferralCode = async () => {
      if (!session?.user || !isSubmitted) return
      
      const twitterId = (session.user as SessionUser).id || session.user.email
      const twitterHandle = session.user.name?.replace('@', '') || session.user.name
      
      if (!twitterId || !twitterHandle) return
      
      const { data } = await supabase
        .from('waitlist_users')
        .select('referral_code')
        .or(`twitter_id.eq.${twitterId},twitter_handle.eq.${twitterHandle}`)
        .single()
      
      if (data?.referral_code) {
        setUserReferralCode(data.referral_code)
      }
    }
    
    fetchReferralCode()
  }, [session, isSubmitted])
  
  
  const handleTwitterAuth = () => {
    console.log('🚀 Starting Twitter auth...')
    sessionStorage.setItem('justAuthenticated', 'true') // Persist across OAuth redirect
    
    // If there's a referral code, include it in the callback URL
    const referralCode = sessionStorage.getItem('referralCode')
    const callbackUrl = referralCode 
      ? `${window.location.origin}?ref=${referralCode}`
      : window.location.origin
    
    signIn('twitter', { callbackUrl })
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #f8d7da 0%, #f4c2a1 50%, #fef7e6 100%)'}}>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-pink-200 shadow-xl relative">
          {/* ADD CLOSE BUTTON */}
          <button 
            onClick={() => {
              setIsSubmitted(false)
              setShowWalletStep(false)
              window.location.reload()
            }}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
          >
            ×
          </button>
          
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-pink-800 mb-2">You made it! 🎉</h2>
          <p className="text-pink-600 mb-6">
            Welcome to the waitlist! {walletAddress ? 'Sweet treats just for you' : 'Add your wallet for exclusive Y2K traits and VIP features.'}
          </p>
          <div className="bg-pink-100 rounded-lg p-4 mb-6 border border-pink-200">
            <p className="text-pink-800 font-medium">Share your referral link:</p>
            <div className="mt-2 flex items-center justify-between bg-white rounded-lg p-2 border border-pink-200">
            <span className="text-pink-600 text-sm">waitlist.baddie.style/ref/{userReferralCode || 'loading'}</span>
              <button className="text-pink-500 hover:text-pink-600">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button 
  onClick={() => {
    const tweetText = `Just joined the BeraBaddie waitlist! 💅✨ Customize your Y2K digital baddie and mint exclusive NFTs. Join me: https://waitlist.baddie.style/ref/${userReferralCode}`
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    
    // Open Twitter in new tab
    window.open(tweetUrl, '_blank')
    
    // Close the modal and return to homepage after a short delay
    setTimeout(() => {
      setIsSubmitted(false)
      setShowWalletStep(false)
      // Optionally reload to show updated state
      window.location.reload()
    }, 1000) // 1 second delay to let Twitter open
  }}
  className="w-full bg-gradient-to-r from-pink-400 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-pink-500 hover:to-pink-600 transition-all duration-200 shadow-lg"
>
  Share on Twitter
</button>
        </div>
      </div>
    );
  }

  if (showWalletStep) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #f8d7da 0%, #f4c2a1 50%, #fef7e6 100%)'}}>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-pink-200 shadow-xl">
          <div className="text-center mb-6">
            <Wallet className="w-16 h-16 text-pink-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-pink-800 mb-2">Connect Your Berachain Wallet</h2>
            <p className="text-pink-600">
              Optional: Add your Berachain wallet address to receive exclusive BeraBaddie traits, early access to limited fashion drops, and VIP customization options!
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-pink-800 font-medium mb-2">Berachain Wallet Address</label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-white border border-pink-200 rounded-lg px-4 py-3 text-pink-800 placeholder-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            
            <div className="bg-pink-100 border border-pink-200 rounded-lg p-4">
              <p className="text-pink-700 text-sm font-medium">💅 Beta Perks Include:</p>
              <ul className="text-pink-600 text-sm mt-2 space-y-1">
                <li>• Early access (48hrs before others)</li>
                <li>• Exclusive Y2K trait collections</li>
                <li>• VIP customization features</li>
                <li>• Limited edition BeraBaddie accessories</li>
              </ul>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleSkipWallet}
                className="flex-1 bg-pink-100 text-pink-600 font-semibold py-3 px-6 rounded-lg hover:bg-pink-200 transition-all duration-200 border border-pink-200"
              >
                Skip
              </button>
              <button
                onClick={handleWalletSubmit}
                className="flex-1 bg-gradient-to-r from-pink-400 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-pink-500 hover:to-pink-600 transition-all duration-200 shadow-lg"
              >
                Add Wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, #f8d7da 0%, #f4c2a1 50%, #fef7e6 100%)'}}>
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      <h1 className="text-pink-800 font-bold text-xl">baddie.style</h1>
    </div>
    <div className="flex items-center space-x-4 text-pink-600/80">
      {session?.user && (
        <div className="flex items-center space-x-2 bg-pink-100 rounded-lg px-3 py-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-pink-700">You&apos;re on the list!</span>
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4" />
        <span className="text-sm">{totalUsers} joined</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
        <span className="text-sm">{recentSignups} in last hour</span>
      </div>
    </div>
  </div>
</header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold text-pink-800 leading-tight">
                Welcome to your
                <span className="bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent"> Baddie Era</span>
              </h1>
              <p className="text-xl text-pink-700 leading-relaxed">
                Customize your Berabaddie with iconic fashion, unlock rare traits through ecosystem participation, and watch your style choices mint into exclusive NFTs. Low-rise jeans, butterfly clips, and digital glamour await. ✨
              </p>
            </div>

{/* Video Preview */}
<div className="relative">
  <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-pink-200 shadow-lg">
    <div className="aspect-video bg-gradient-to-br from-pink-100 to-pink-200 rounded-lg relative overflow-hidden border border-pink-200">
      <video 
        controls 
        className="w-full h-full object-cover"
      >
        <source src="/minibaddie.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
    <p className="text-pink-600 text-sm mt-4 text-center">
      Xoxo, Berabaddies
    </p>
  </div>
</div>

            {/* Referral Notification */}
            {incomingReferralCode && (
              <div className="bg-gradient-to-r from-purple-200/70 to-pink-200/70 border border-purple-300 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <h3 className="text-purple-800 font-semibold">You&apos;ve been referred!</h3>
                </div>
                <p className="text-purple-700">
                  A friend invited you to join the BeraBaddie waitlist. Sign up now to secure your spot and give them credit for the referral! 💜
                </p>
              </div>
            )}

            {/* Beta Perks Callout */}
            <div className="bg-gradient-to-r from-pink-200/70 to-pink-300/70 border border-pink-300 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Trophy className="w-6 h-6 text-pink-600" />
                <h3 className="text-pink-800 font-semibold">Exclusive Beta Perks</h3>
              </div>
              <p className="text-pink-700 mb-4">
                Drop your Berachain wallet address when joining the waitlist for a treat, and earn rare traits by sharing your referral link. 
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-4">
  <button
    onClick={() => {
      if (userStatus === 'existing') {
        // Do nothing - user is already fully signed up
        return;
      } else if (userStatus === 'new' && session?.user) {
        // User is authenticated but needs to complete wallet step
        setShowWalletStep(true);
      } else {
        // User needs to sign in
        handleTwitterAuth();
      }
    }}
    disabled={status === 'loading' || userStatus === 'checking' || userStatus === 'existing'}
    className="w-full bg-gradient-to-r from-pink-400 to-pink-500 text-white font-semibold py-4 px-8 rounded-xl hover:from-pink-500 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
  >
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
    </svg>
    <span>
      {userStatus === 'checking' ? 'Loading...' :
       userStatus === 'existing' ? 'You are already In!' :
       userStatus === 'new' && session?.user ? 'Add Wallet Address' :
       'Join Waitlist with Twitter'}
    </span>
  </button>
  <p className="text-center text-pink-600 text-sm">
  {userStatus === 'existing' ? 'Thanks for joining!' :
   `Join ${totalUsers}+ fashion lovers and NFT collectors already on the waitlist`}
</p>
</div>
          </div>

          {/* Right Column - Waitlist */}
          <div className="space-y-6">
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-pink-200 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-pink-800">Already Signed Up</h2>
                <div className="flex items-center space-x-2 text-pink-600">
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">Live</span>
                </div>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {waitlistMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-4 p-3 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors border border-pink-100">
                    <img 
                      src={member.twitter_avatar} 
                      alt={member.twitter_handle}
                      className="w-12 h-12 rounded-full border-2 border-pink-200"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-pink-800 font-medium">@{member.twitter_handle}</span>
                        {member.is_verified && (
                          <div className="w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center">
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg> 
                          </div>
                        )}
                        {member.wallet_address && (
                          <Wallet className="w-4 h-4 text-pink-500" />
                        )}
                      </div>
                      <p className="text-pink-600 text-sm">{formatFollowers(member.follower_count)} followers</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}