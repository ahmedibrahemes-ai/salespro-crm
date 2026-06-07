import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, data } = body

    const zai = await ZAI.create()

    let systemPrompt = ''
    let userPrompt = ''

    switch (type) {
      case 'analyze-performance': {
        systemPrompt = `أنت خبير تحليل مبيعات ومدير أداء. حلل البيانات المقدمة وأعطِ:
1. ملخص الأداء العام
2. أهم 3 نقاط قوة
3. أهم 3 نقاط ضعف
4. توصيات عملية لتحسين الأداء
5. توقع للأداء الأسبوع القادم
اكتب الرد بالعربية بشكل مختصر ومباشر.`
        userPrompt = `حلل أداء المبيعات التالي:\n${JSON.stringify(data, null, 2)}`
        break
      }
      case 'call-analysis': {
        systemPrompt = `أنت خبير تحليل مكالمات مبيعات. قيّم المكالمة وأعطِ:
1. ملخص المكالمة (سطرين)
2. Score من 10 بناءً على: tone, objection handling, closing technique
3. أهم نقطة إيجابية
4. نصيحة تحسين واحدة
5. أفضل رد مقترح للخطوة التالية
اكتب الرد بالعربية بشكل مختصر.`
        userPrompt = `حلل هذه المكالمة:\nالعميل: ${data.leadName}\nالمرحلة: ${data.stage}\nالمدة: ${data.duration} ثانية\nالملاحظات: ${data.notes || 'غير متوفرة'}`
        break
      }
      case 'predict-closure': {
        systemPrompt = `أنت خبير توقع مبيعات. بناءً على بيانات العميل، أعطِ:
1. نسبة احتمال الإغلاق (رقم من 0-100)
2. السبب الرئيسي للتوقع
3. أفضل خطوة تالية لزيادة الاحتمال
اكتب الرد بالعربية بشكل مختصر جداً.`
        userPrompt = `توقع احتمال الإغلاق لهذا العميل:\nالاسم: ${data.name}\nالمرحلة: ${data.status}\nالقيمة: ${data.value} EGP\nالاحتمال الحالي: ${data.probability}%\nHot: ${data.hot}\nعدد الأنشطة: ${data.activityCount}\nآخر تواصل: ${data.lastContactAt}`
        break
      }
      case 'coaching': {
        systemPrompt = `أنت مدرب مبيعات محترف. بناءً على أداء الموظف، أعطِ:
1. تقييم عام (ممتاز/جيد/مقبول/يحتاج تحسين)
2. أهم مهارة يجب تطويرها
3. تمرين عملي مقترح
4. هدف أسبوعي مقترح
اكتب الرد بالعربية بشكل محفز وعملي.`
        userPrompt = `أعطِ coaching لهذا الموظف:\nالاسم: ${data.name}\nالصفقات: ${data.deals}\nالإيرادات: ${data.revenue} EGP\nالمكالمات: ${data.calls}\nمعدل التحويل: ${data.convRate}%\nالنقاط: ${data.points}`
        break
      }
      case 'smart-reply': {
        systemPrompt = `أنت خبير كتابة ردود مبيعات. اكتب رد مناسب واحترافي بالعربية للرسالة المرسلة. الرد يجب أن يكون:
1. مهذب ومحترف
2. يدفع العميل للخطوة التالية
3. قصير (3-4 أسطر كحد أقصى)`
        userPrompt = `رسالة العميل: "${data.message}"\nاسم العميل: ${data.leadName}\nالمرحلة: ${data.stage}\nاكتب الرد المناسب.`
        break
      }
      default: {
        systemPrompt = 'أنت مساعد ذكي لمنصة مبيعات. ساعد بالإجابة بالعربية بشكل مختصر.'
        userPrompt = data.prompt || 'مرحباً'
      }
    }

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content || 'لم أتمكن من التحليل'

    return NextResponse.json({ success: true, response, type })
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json(
      { success: false, error: 'AI analysis failed', response: 'حدث خطأ في التحليل. حاول مرة أخرى.' },
      { status: 500 }
    )
  }
}
