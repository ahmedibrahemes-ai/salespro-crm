import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Demo data seeder — idempotent
export async function POST() {
  try {
    // Check if data already exists
    const leadCount = await db.lead.count()
    if (leadCount > 0) {
      return NextResponse.json({ message: 'Data already seeded', count: leadCount })
    }

    // Create team members
    const ahmed = await db.teamMember.create({
      data: { name: 'Ahmed Salem', nameAr: 'أحمد سالم', role: 'sales', initials: 'أح', points: 1240, deals: 11, revenue: 84000, calls: 83, convRate: 13, badges: '["Closer","Speed","Top 10%","100 Calls","Champion"]' },
    })
    const reem = await db.teamMember.create({
      data: { name: 'Reem Khaled', nameAr: 'ريم خالد', role: 'sales', initials: 'ري', points: 890, deals: 9, revenue: 63000, calls: 95, convRate: 11, badges: '["100 Calls","Steady"]' },
    })
    const waleed = await db.teamMember.create({
      data: { name: 'Waleed Nasser', nameAr: 'وليد نصر', role: 'sales', initials: 'ول', points: 720, deals: 7, revenue: 51000, calls: 68, convRate: 10, badges: '["Fast Follow-up"]' },
    })
    const marwa = await db.teamMember.create({
      data: { name: 'Marwa Hussein', nameAr: 'مروة حسين', role: 'sales', initials: 'مر', points: 540, deals: 5, revenue: 38000, calls: 52, convRate: 9, badges: '[]' },
    })

    // Tele team members
    const amira = await db.teamMember.create({
      data: { name: 'Amira', nameAr: 'أميرة', role: 'tele', initials: 'أم', points: 950, deals: 0, revenue: 0, calls: 120, convRate: 15, badges: '["100 Calls"]' },
    })
    const neveen = await db.teamMember.create({
      data: { name: 'Neveen', nameAr: 'نيفين', role: 'tele', initials: 'ني', points: 820, deals: 0, revenue: 0, calls: 105, convRate: 12, badges: '[]' },
    })

    // Create target
    const now = new Date()
    await db.target.create({
      data: { month: now.getMonth() + 1, year: now.getFullYear(), targetAmount: 115000, achievedAmount: 84000 },
    })

    // Helper to create date in past
    const daysAgo = (days: number) => {
      const d = new Date()
      d.setDate(d.getDate() - days)
      return d
    }
    const hoursAgo = (hours: number) => {
      const d = new Date()
      d.setHours(d.getHours() - hours)
      return d
    }

    // Today's date string for meetingDate
    const todayStr = now.toISOString().split('T')[0]
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

    // Create leads with CRM-specific fields
    const leads = await Promise.all([
      // Hot leads - need attention
      db.lead.create({ data: { name: 'نهى إبراهيم', phone: '01012345678', email: 'noha@rouya.com', source: 'meta-ads', status: 'followup', value: 20000, probability: 87, hot: true, company: 'شركة رؤية للتسويق', location: 'القاهرة', assignedTo: ahmed.name, teleName: amira.name, salesName: ahmed.name, meetingDate: tomorrowStr, meetingTime: '14:00', meetingType: 'online', contactResult: 'replied', contactResultAt: hoursAgo(2), lastContactAt: hoursAgo(2), nextFollowUp: new Date(new Date().setHours(14, 0, 0, 0)), followUpType: 'call', notes: '[]' } }),
      db.lead.create({ data: { name: 'سارة أحمد', phone: '01098765432', email: 'sara@example.com', source: 'meta-ads', status: 'followup', value: 12000, probability: 65, hot: true, company: '', location: 'الإسكندرية', assignedTo: ahmed.name, teleName: neveen.name, salesName: ahmed.name, contactResult: 'callback', contactResultAt: hoursAgo(4), lastContactAt: hoursAgo(4), notes: '[]' } }),
      db.lead.create({ data: { name: 'هبة مصطفى', phone: '01155544433', email: 'heba@tech.com', source: 'google-ads', status: 'negotiation', value: 30000, probability: 75, hot: true, company: 'Tech Solutions', location: 'الجيزة', assignedTo: reem.name, teleName: amira.name, salesName: reem.name, meetingDate: todayStr, meetingTime: '16:00', meetingType: 'online', attended: 'attended', attendanceMarkedAt: hoursAgo(1), contactResult: 'replied', contactResultAt: daysAgo(2), lastContactAt: daysAgo(2), notes: '[]' } }),

      // Overdue leads - need attention
      db.lead.create({ data: { name: 'محمد السيد', phone: '01234567890', email: 'mohamed@example.com', source: 'meta-ads', status: 'followup', value: 18000, probability: 55, hot: false, company: '', location: 'القاهرة', assignedTo: ahmed.name, teleName: amira.name, salesName: ahmed.name, contactResult: 'no-reply', contactResultAt: daysAgo(5), lastContactAt: daysAgo(5), nextFollowUp: daysAgo(3), followUpType: 'call', notes: '[]' } }),
      db.lead.create({ data: { name: 'أسامة فريد', phone: '01099988877', email: 'osama@example.com', source: 'google-ads', status: 'no-reply', value: 8000, probability: 35, hot: false, company: '', location: 'المنصورة', assignedTo: reem.name, teleName: neveen.name, salesName: reem.name, contactResult: 'no-reply', contactResultAt: daysAgo(6), lastContactAt: daysAgo(6), nextFollowUp: daysAgo(4), followUpType: 'whatsapp', notes: '[]' } }),
      db.lead.create({ data: { name: 'عمر حسام', phone: '01177766655', email: 'omar@biz.com', source: 'website', status: 'callback', value: 5000, probability: 30, hot: false, company: 'Biz Corp', location: 'طنطا', assignedTo: waleed.name, teleName: amira.name, salesName: waleed.name, contactResult: 'callback', contactResultAt: daysAgo(7), lastContactAt: daysAgo(7), nextFollowUp: daysAgo(2), followUpType: 'call', notes: '[]' } }),

      // Today follow-ups
      db.lead.create({ data: { name: 'علي منصور', phone: '01288877766', email: 'ali@mansour.com', source: 'referral', status: 'proposal-sent', value: 15000, probability: 60, hot: false, company: 'منصور جروب', location: 'القاهرة', assignedTo: ahmed.name, teleName: neveen.name, salesName: ahmed.name, contactResult: 'replied', contactResultAt: daysAgo(1), lastContactAt: daysAgo(1), nextFollowUp: new Date(new Date().setHours(16, 0, 0, 0)), followUpType: 'call', notes: '[]' } }),
      db.lead.create({ data: { name: 'رنا محمود', phone: '01066655544', email: 'rana@example.com', source: 'website', status: 'whatsapp', value: 3500, probability: 40, hot: false, company: '', location: 'الإسماعيلية', assignedTo: marwa.name, teleName: amira.name, salesName: marwa.name, contactResult: 'whatsapp', contactResultAt: daysAgo(3), lastContactAt: daysAgo(3), nextFollowUp: new Date(new Date().setHours(17, 30, 0, 0)), followUpType: 'whatsapp', notes: '[]' } }),
      db.lead.create({ data: { name: 'عمرو خالد', phone: '01144433322', email: 'amr@khaled.com', source: 'linkedin', status: 'followup', value: 9000, probability: 50, hot: false, company: '', location: 'القاهرة', assignedTo: ahmed.name, teleName: neveen.name, salesName: ahmed.name, contactResult: 'replied', contactResultAt: daysAgo(1), lastContactAt: daysAgo(1), nextFollowUp: new Date(), followUpType: 'call', notes: '[]' } }),

      // Pipeline leads
      db.lead.create({ data: { name: 'ياسمين حسن', phone: '01222211100', email: 'yasmin@example.com', source: 'meta-ads', status: 'new', value: 5000, probability: 20, hot: false, company: '', location: 'القاهرة', assignedTo: reem.name, teleName: amira.name, salesName: reem.name, lastContactAt: hoursAgo(2), notes: '[]' } }),
      db.lead.create({ data: { name: 'طارق عمر', phone: '01033322211', email: 'tarek@example.com', source: 'google-ads', status: 'new', value: 3500, probability: 20, hot: false, company: '', location: 'الإسكندرية', assignedTo: waleed.name, teleName: neveen.name, salesName: waleed.name, lastContactAt: hoursAgo(4), notes: '[]' } }),
      db.lead.create({ data: { name: 'منى فاروق', phone: '01188877766', email: 'mona@farouk.com', source: 'website', status: 'new', value: 2800, probability: 20, hot: false, company: '', location: 'المنصورة', assignedTo: marwa.name, teleName: amira.name, salesName: marwa.name, lastContactAt: hoursAgo(6), notes: '[]' } }),
      db.lead.create({ data: { name: 'كريم عادل', phone: '01255544433', email: 'karim@adil.com', source: 'google-ads', status: 'meeting-done', value: 8000, probability: 35, hot: false, company: '', location: 'الجيزة', assignedTo: reem.name, teleName: neveen.name, salesName: reem.name, meetingDate: daysAgo(2).toISOString().split('T')[0], attended: 'attended', contactResult: 'replied', contactResultAt: daysAgo(1), lastContactAt: daysAgo(1), notes: '[]' } }),
      db.lead.create({ data: { name: 'محمود رضا', phone: '01077766655', email: 'mahmoud@reda.com', source: 'referral', status: 'meeting-done', value: 15000, probability: 55, hot: false, company: 'محمود رضا وأولاده', location: 'القاهرة', assignedTo: waleed.name, teleName: amira.name, salesName: waleed.name, meetingDate: daysAgo(3).toISOString().split('T')[0], attended: 'attended', contactResult: 'replied', contactResultAt: daysAgo(3), lastContactAt: daysAgo(3), notes: '[]' } }),

      // Won deals (closed-won)
      db.lead.create({ data: { name: 'رنا طه', phone: '01122211100', email: 'rana@taha.com', source: 'meta-ads', status: 'closed-won', value: 18000, probability: 100, hot: false, company: '', location: 'القاهرة', assignedTo: ahmed.name, teleName: amira.name, salesName: ahmed.name, attended: 'attended', meetingDate: daysAgo(5).toISOString().split('T')[0], contactResult: 'replied', contactResultAt: daysAgo(0), lastContactAt: daysAgo(0), notes: '[]' } }),
      db.lead.create({ data: { name: 'سامي إبراهيم', phone: '01244433322', email: 'sami@ibrahim.com', source: 'referral', status: 'closed-won', value: 22000, probability: 100, hot: false, company: 'إبراهيم للأعمال', location: 'الإسكندرية', assignedTo: ahmed.name, teleName: neveen.name, salesName: ahmed.name, attended: 'attended', meetingDate: daysAgo(7).toISOString().split('T')[0], contactResult: 'replied', contactResultAt: daysAgo(1), lastContactAt: daysAgo(1), notes: '[]' } }),
      db.lead.create({ data: { name: 'ليلى محمد', phone: '01088877766', email: 'layla@example.com', source: 'google-ads', status: 'closed-won', value: 11000, probability: 100, hot: false, company: '', location: 'طنطا', assignedTo: reem.name, teleName: amira.name, salesName: reem.name, attended: 'attended', meetingDate: daysAgo(4).toISOString().split('T')[0], contactResult: 'replied', contactResultAt: daysAgo(2), lastContactAt: daysAgo(2), notes: '[]' } }),

      // Lost deals (closed-lost)
      db.lead.create({ data: { name: 'أسامة فؤاد', phone: '01199988877', email: 'osama@fouad.com', source: 'cold-call', status: 'closed-lost', value: 6000, probability: 0, hot: false, company: '', location: 'القاهرة', assignedTo: waleed.name, teleName: neveen.name, salesName: waleed.name, contactResult: 'not-interested', contactResultAt: daysAgo(5), lastContactAt: daysAgo(5), lostReason: 'price', notes: '[]' } }),
      db.lead.create({ data: { name: 'حنان سعيد', phone: '01266655544', email: 'hanan@example.com', source: 'website', status: 'closed-lost', value: 4000, probability: 0, hot: false, company: '', location: 'المنصورة', assignedTo: marwa.name, teleName: amira.name, salesName: marwa.name, contactResult: 'wrong-number', contactResultAt: daysAgo(8), lastContactAt: daysAgo(8), lostReason: 'slow-response', notes: '[]' } }),
      db.lead.create({ data: { name: 'طارق محمود', phone: '01044433322', email: 'tariq@mahmoud.com', source: 'referral', status: 'new', value: 7500, probability: 25, hot: false, company: '', location: 'القاهرة', assignedTo: ahmed.name, teleName: neveen.name, salesName: ahmed.name, lastContactAt: daysAgo(0), notes: '[]' } }),
    ])

    // Create activities for hot leads
    const noha = leads[0]
    await db.activity.createMany({
      data: [
        { leadId: noha.id, type: 'call', text: 'مكالمة 12:04 دقيقة — مهتمة جداً بالباقة المتوسطة، سألت عن الدفع على مراحل', score: 9.1, duration: 724 },
        { leadId: noha.id, type: 'whatsapp', text: 'واتساب: "شكراً للتواصل، هبعتلك الـ Proposal النهارده" — قرأته ✓✓', score: 0, duration: 0 },
        { leadId: noha.id, type: 'email', text: 'إيميل: Proposal مرسل — فتحته مرتين 👀 — لم يرد بعد', score: 0, duration: 0 },
        { leadId: noha.id, type: 'call', text: 'مكالمة 8:30 دقيقة — مهتمة بخدمة SEO بشكل خاص، طلبت أمثلة نتائج', score: 8.5, duration: 510 },
        { leadId: noha.id, type: 'note', text: 'ملاحظة: تسأل بشكل خاص عن SEO وإدارة الإعلانات — لديها ميزانية جيدة', score: 0, duration: 0 },
        { leadId: noha.id, type: 'whatsapp', text: 'أول تواصل عبر واتساب بعد Meta Ad — ردت في أقل من دقيقة', score: 0, duration: 0 },
      ],
    })

    // Activities for other leads
    const karim = leads[12]
    await db.activity.create({
      data: { leadId: karim.id, type: 'call', text: 'مكالمة 5:30 دقيقة — يقارن بين أسعار الشركات، يحتاج مقارنة تنافسية', score: 7.4, duration: 330 },
    })

    // Create chat messages for WhatsApp
    await db.chatMessage.createMany({
      data: [
        { leadId: noha.id, fromMe: true, text: 'أهلاً نهى، بعتلك الـ Proposal على الإيميل. ممكن تراجعيه وتعطيني رأيك؟', read: true },
        { leadId: noha.id, fromMe: false, text: 'شكراً كتير! فتحته وهو تمام. عندي سؤال واحد بس..', read: true },
        { leadId: noha.id, fromMe: false, text: 'هل ممكن دفع على مرحلتين؟ 🙏', read: false },
      ],
    })

    return NextResponse.json({
      message: 'Demo data seeded successfully',
      leads: leads.length,
    })
  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}
