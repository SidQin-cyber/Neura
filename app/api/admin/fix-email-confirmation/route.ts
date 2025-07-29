import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    
    // 获取所有未确认邮箱的用户
    const { data: unconfirmedUsers, error: fetchError } = await supabase
      .from('auth.users')
      .select('email')
      .is('email_confirmed_at', null)
    
    if (fetchError) {
      // 如果无法直接查询，尝试确认已知的用户
      const knownEmails = [
        'duang@neura.app',
        'qinguoqg123@neura.app'
      ]
      
      const results = []
      for (const email of knownEmails) {
        try {
          await supabase.rpc('confirm_user_email', { user_email: email })
          results.push({ email, status: 'confirmed' })
        } catch (error) {
          results.push({ email, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Attempted to confirm known unconfirmed emails',
        results
      })
    }
    
    // 批量确认所有未验证邮箱
    const results = []
    for (const user of unconfirmedUsers || []) {
      try {
        await supabase.rpc('confirm_user_email', { user_email: user.email })
        results.push({ email: user.email, status: 'confirmed' })
      } catch (error) {
        results.push({ 
          email: user.email, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} users`,
      results
    })
    
  } catch (error) {
    console.error('Email confirmation fix error:', error)
    return NextResponse.json(
      { error: 'Failed to fix email confirmations: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
} 