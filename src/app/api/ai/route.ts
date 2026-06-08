import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

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
        userPrompt = `Analyze this call:\nClient: ${data.leadName}\nStage: ${data.stage}\nDuration: ${data.duration} seconds\nNotes: ${data.notes || 'Not available'}`
        break
      }
      case 'predict-closure': {
        systemPrompt = `You are an expert sales prediction analyst. Based on client data, give:
1. Closure probability percentage (0-100)
2. Main reason for the prediction
3. Best next step to increase probability
Write the response very concisely.`
        userPrompt = `Predict closure probability for this client:\nName: ${data.name}\nStage: ${data.status}\nMeetings: ${data.meetings || 0}\nAttended: ${data.attended || 'pending'}\nSales status: ${data.salesStatus || 'N/A'}\nContact result: ${data.contactResult || 'N/A'}`
        break
      }
      case 'coaching': {
        systemPrompt = `You are a professional sales coach. Based on employee performance, give:
1. Overall assessment (Excellent/Good/Acceptable/Needs improvement)
2. Top skill to develop
3. Suggested practical exercise
4. Suggested weekly goal
Write the response in a motivating and practical manner.`
        userPrompt = `Provide coaching for this employee:\nName: ${data.name}\nDeals: ${data.deals}\nRevenue: ${data.revenue}\nCalls: ${data.calls}\nConversion rate: ${data.convRate}%\nPoints: ${data.points}`
        break
      }
      case 'smart-reply': {
        systemPrompt = `You are an expert sales reply writer. Write an appropriate, professional reply for the sent message. The reply should be:
1. Polite and professional
2. Push the client to the next step
3. Short (3-4 lines max)`
        userPrompt = `Client message: "${data.message}"\nClient name: ${data.leadName}\nStage: ${data.stage}\nWrite the appropriate reply.`
        break
      }
      default: {
        systemPrompt = 'You are an intelligent assistant for a sales platform. Help with answering concisely.'
        userPrompt = data?.prompt || 'Hello'
      }
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content || 'Unable to analyze'

    return NextResponse.json({ success: true, response, type })
  } catch (error) {
    console.error('AI API error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: 'AI analysis failed', response: `An error occurred during analysis: ${message}` },
      { status: 500 }
    )
  }
}
