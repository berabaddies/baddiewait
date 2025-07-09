'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'

export default function ReferralPage() {
  const router = useRouter()
  const params = useParams()
  const referralCode = params.code as string

  useEffect(() => {
    if (referralCode) {
      // Store the referral code in sessionStorage so it persists through OAuth
      sessionStorage.setItem('referralCode', referralCode)
      
      // Redirect to home page where user can sign up
      router.push('/')
    }
  }, [referralCode, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #f8d7da 0%, #f4c2a1 50%, #fef7e6 100%)'}}>
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-pink-200 shadow-xl">
        <h2 className="text-2xl font-bold text-pink-800 mb-4">Welcome to BeraBaddie!</h2>
        <p className="text-pink-600 mb-6">
          You&apos;ve been referred by a friend! Redirecting you to join the waitlist...
        </p>
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}