import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { requireAuth, unauthorizedResponse } from '@/lib/auth-guard'

/**
 * POST /api/ai
 *
 * AI analysis using z-ai-web-dev-sdk (backend only).
 * Accepts { type, data } and returns AI-generated analysis.
 *
 * Supported types:
 * - analyze-performance: Sales performance analysis
 * - call-analysis: Call quality evaluation
 * - predict-closure: Closure probability prediction
 * - coaching: Sales coaching recommendations
 * - smart-reply: Generate professional reply
 *
 * IMPORTANT: z-ai-web-dev-sdk MUST be used in backend only!
 * NO Prisma/SQLite — Supabase ONLY for data retrieval (if needed).
 * NO hardcoded credentials — environment variables only.
 */

// Allowed AI task types — validates input before sending to the LLM
const ALLOWED_TYPES = new Set([
  'analyze-performance',
  'call-analysis',
  'predict-closure',
  'coaching',
  'smart-reply',
])

export async function POST(request: NextRequest) {
  // ===== Authentication: every AI call must be from a signed-in user =====
  const session = await requireAuth(request)
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { type, data } = body

    // Validate input
    if (!type || typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { success: false, error: 'نوع التحليل غير صالح' },
        { status: 400 }
      )
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'البيانات المقدمة غير صالحة' },
        { status: 400 }
      )
    }

    const zai = await ZAI.create()

    let systemPrompt = ''
    let userPrompt = ''

    switch (type) {
      case 'analyze-performance': {
        systemPrompt = `You are an expert sales performance analyst and manager. Analyze the provided data and give:
1. Overall performance summary
2. Top 3 strengths
3. Top 3 weaknesses
4. Actionable recommendations to improve performance
5. Prediction for next week's performance
Write the response in a concise, professional manner. If the data is in Arabic, respond in Arabic.`
        userPrompt = `Analyze the following sales performance data:\n${JSON.stringify(data, null, 2)}`
        break
      }
      case 'call-analysis': {
        systemPrompt = `You are an expert sales call analyst. Evaluate the call and give:
1. Call summary (2 lines)
2. Score out of 10 based on: tone, objection handling, closing technique
3. Top positive point
4. One improvement tip
5. Best suggested next step reply
Write the response concisely.`
        const leadName = String(data.leadName || 'Unknown').slice(0, 200)
        const stage = String(data.stage || 'unknown').slice(0, 100)
        const duration = Number(data.duration) || 0
        const notes = String(data.notes || 'Not available').slice(0, 2000)
        userPrompt = `Analyze this call:\nClient: ${leadName}\nStage: ${stage}\nDuration: ${duration} seconds\nNotes: ${notes}`
        break
      }
      case 'predict-closure': {
        systemPrompt = `You are an expert sales prediction analyst. Based on client data, give:
1. Closure probability percentage (0-100)
2. Main reason for the prediction
3. Best next step to increase probability
Write the response very concisely.`
        const name = String(data.name || 'Unknown').slice(0, 200)
        const status = String(data.status || 'unknown').slice(0, 100)
        const meetings = Number(data.meetings) || 0
        const attended = String(data.attended || 'pending').slice(0, 50)
        const salesStatus = String(data.salesStatus || 'N/A').slice(0, 100)
        const contactResult = String(data.contactResult || 'N/A').slice(0, 100)
        userPrompt = `Predict closure probability for this client:\nName: ${name}\nStage: ${status}\nMeetings: ${meetings}\nAttended: ${attended}\nSales status: ${salesStatus}\nContact result: ${contactResult}`
        break
      }
      case 'coaching': {
        systemPrompt = `You are a professional sales coach. Based on employee performance, give:
1. Overall assessment (Excellent/Good/Acceptable/Needs improvement)
2. Top skill to develop
3. Suggested practical exercise
4. Suggested weekly goal
Write the response in a motivating and practical manner.`
        const name = String(data.name || 'Employee').slice(0, 200)
        const deals = Number(data.deals) || 0
        const revenue = Number(data.revenue) || 0
        const calls = Number(data.calls) || 0
        const convRate = Number(data.convRate) || 0
        const points = Number(data.points) || 0
        userPrompt = `Provide coaching for this employee:\nName: ${name}\nDeals: ${deals}\nRevenue: ${revenue}\nCalls: ${calls}\nConversion rate: ${convRate}%\nPoints: ${points}`
        break
      }
      case 'smart-reply': {
        systemPrompt = `You are an expert sales reply writer. Write an appropriate, professional reply for the sent message. The reply should be:
1. Polite and professional
2. Push the client to the next step
3. Short (3-4 lines max)`
        const message = String(data.message || '').slice(0, 2000)
        const leadName = String(data.leadName || 'Customer').slice(0, 200)
        const stage = String(data.stage || 'unknown').slice(0, 100)
        userPrompt = `Client message: "${message}"\nClient name: ${leadName}\nStage: ${stage}\nWrite the appropriate reply.`
        break
      }
      default: {
        // Unreachable — input validation above rejects unknown types
        return NextResponse.json(
          { success: false, error: 'نوع غير مدعوم' },
          { status: 400 }
        )
      }
    }

    const completion = await zai.chat.completions.create({
      messages: [
        // FIX: system prompts must use role: 'system' (was 'assistant')
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content || 'تعذر التحليل'

    return NextResponse.json({ success: true, response, type })
  } catch (error) {
    console.error('AI API error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: 'AI analysis failed', response: `حدث خطأ أثناء التحليل: ${message}` },
      { status: 500 }
    )
  }
}
