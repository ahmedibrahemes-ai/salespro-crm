'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Bot,
  ChevronDown,
  ChevronUp,
  Save,
  Bell,
  Shield,
} from 'lucide-react'
import {
  useCrmStore,
  type TelegramConfig,
} from '@/lib/store'
import { apiGetSetting, apiSaveSetting } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ===== Main Component =====
export function TelegramSetup() {
  const {
    currentUser,
    currentRole,
    team,
    telegramConfig,
    setTelegramConfig,
    addToast,
  } = useCrmStore()

  const [botToken, setBotToken] = useState(telegramConfig.botToken || '')
  const [groupChatId, setGroupChatId] = useState(telegramConfig.groupChatId || '')
  const [salesChats, setSalesChats] = useState<Record<string, string>>(
    telegramConfig.salesChats || {}
  )
  const [showIndividualChats, setShowIndividualChats] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(!!telegramConfig.botToken)

  // Load config from API on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const saved = await apiGetSetting('telegram_config')
        if (saved && typeof saved === 'object') {
          const cfg = saved as TelegramConfig
          if (cfg.botToken) {
            setBotToken(cfg.botToken)
            setGroupChatId(cfg.groupChatId || '')
            setSalesChats(cfg.salesChats || {})
            setTelegramConfig(cfg)
            setConnected(true)
          }
        }
      } catch {
        // Silently fail - use store defaults
      }
    }
    loadConfig()
  }, [setTelegramConfig])

  // Save config
  const handleSave = useCallback(async () => {
    if (!botToken.trim()) {
      addToast('error', 'يرجى إدخال Bot Token')
      return
    }
    if (!groupChatId.trim()) {
      addToast('error', 'يرجى إدخال Group Chat ID')
      return
    }

    setSaving(true)
    try {
      const cfg: TelegramConfig = {
        botToken: botToken.trim(),
        groupChatId: groupChatId.trim(),
        salesChats,
      }
      await apiSaveSetting('telegram_config', cfg)
      setTelegramConfig(cfg)
      setConnected(true)
      addToast('success', '✅ تم حفظ إعدادات التليجرام')
    } catch {
      addToast('error', 'فشل في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }, [botToken, groupChatId, salesChats, setTelegramConfig, addToast])

  // Test connection
  const handleTest = useCallback(async () => {
    if (!botToken.trim() || !groupChatId.trim()) {
      addToast('error', 'املي Token و Chat ID الأول')
      return
    }

    setTesting(true)
    addToast('info', 'جاري الإرسال...')

    try {
      const msg = '🧪 <b>اختبار Venom CRM</b>\n\nلو شفت الرسالة دي يبقى البوت شغال! ✅'
      const response = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupChatId.trim(),
            text: msg,
            parse_mode: 'HTML',
          }),
        }
      )

      const data = await response.json()
      if (data.ok) {
        addToast('success', '✅ تم! شيك على التليجرام')
      } else {
        addToast('error', `❌ فشل: ${data.description || 'خطأ غير معروف'}`)
      }
    } catch {
      addToast('error', '❌ فشل في الاتصال بالبوت')
    } finally {
      setTesting(false)
    }
  }, [botToken, groupChatId, addToast])

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast('success', 'تم النسخ')
  }

  // Admin-only guard
  if (!currentUser || currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-muted-foreground">غير متاح</h3>
          <p className="text-sm text-muted-foreground">إعداد التليجرام متاح للأدمن فقط</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5">
      {/* Header Card with Status */}
      <Card className="bg-card border border-border overflow-hidden">
        <div
          className={`h-1 ${
            connected
              ? 'bg-gradient-to-l from-emerald-500 to-venom'
              : 'bg-gradient-to-l from-red-500 to-amber-500'
          }`}
        />
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🐍</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-venom">ربط بوت التليجرام</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                إشعارات فورية للسيلز أول ما التيلي تحوّل عميل. مجاناً ومن غير CallMeBot.
              </p>
            </div>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                connected
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {connected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  البوت متصل ✓
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  البوت مش متصل بعد
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step Guide */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📋 الإعداد - 4 خطوات بس</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-venom/15 flex items-center justify-center text-venom text-sm font-bold shrink-0">
                1
              </div>
              <div className="w-px h-full bg-venom/20 mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <h3 className="text-sm font-semibold">افتح التليجرام وروح لـ @BotFather</h3>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>
                  ابحث عن <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">@BotFather</code> في التليجرام واضغط Start.
                </p>
                <p>
                  ابعتله: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">/newbot</code>
                </p>
                <p>
                  اختار اسم للبوت مثلاً: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">Venom CRM Bot</code>
                </p>
                <p>
                  اختار username ينتهي بـ <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">bot</code> مثلاً:{' '}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">venom_crm_bot</code>
                </p>
                <p>
                  هيديك <strong>Bot Token</strong> - انسخه واحفظه.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-venom/15 flex items-center justify-center text-venom text-sm font-bold shrink-0">
                2
              </div>
              <div className="w-px h-full bg-venom/20 mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <h3 className="text-sm font-semibold">اعمل Group أو خد Chat ID لكل سيلز</h3>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p>
                  <strong>الطريقة الأسهل (Group واحد):</strong>
                </p>
                <p>اعمل جروب تليجرام جديد، ضيف فيه السيلز كلهم + البوت بتاعك.</p>
                <p>ابعت أي رسالة في الجروب.</p>
                <p>
                  روح للينك ده في المتصفح (بدّل <code className="bg-muted px-1 py-0.5 rounded text-foreground">TOKEN</code> بالـ Token بتاعك):
                </p>
                <div className="relative group mt-1">
                  <pre className="bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto" dir="ltr">
                    https://api.telegram.org/bot[TOKEN]/getUpdates
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 top-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-venom"
                    onClick={() =>
                      copyToClipboard('https://api.telegram.org/bot[TOKEN]/getUpdates')
                    }
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p>
                  هتلاقي <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">&quot;chat&quot;:&#123;&quot;id&quot;:-1234567890&#125;</code> - ده الـ Group Chat ID.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-venom/15 flex items-center justify-center text-venom text-sm font-bold shrink-0">
                3
              </div>
              <div className="w-px h-full bg-venom/20 mt-1" />
            </div>
            <div className="flex-1 pb-4">
              <h3 className="text-sm font-semibold">حط البيانات هنا</h3>
              <div className="mt-3 space-y-3">
                {/* Bot Token */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Bot Token
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="1234567890:ABCdefGHI..."
                      className="bg-background border-border pr-10 font-mono text-sm"
                      dir="ltr"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-venom"
                      onClick={() => copyToClipboard(botToken)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Group Chat ID */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Group Chat ID (الكل في جروب واحد)
                  </label>
                  <div className="relative">
                    <Input
                      value={groupChatId}
                      onChange={(e) => setGroupChatId(e.target.value)}
                      placeholder="-1001234567890"
                      className="bg-background border-border pr-10 font-mono text-sm"
                      dir="ltr"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-venom"
                      onClick={() => copyToClipboard(groupChatId)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Individual Sales Chat IDs */}
                <div>
                  <button
                    className="flex items-center gap-1 text-xs text-venom hover:text-venom/80 cursor-pointer"
                    onClick={() => setShowIndividualChats(!showIndividualChats)}
                  >
                    {showIndividualChats ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    أو ابعت لكل سيلز على حدة (اختياري)
                  </button>

                  {showIndividualChats && (
                    <div className="mt-3 p-3 bg-muted/30 border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground mb-3">
                        لو كل سيلز عاوز يستلم على Chat منفصل، حط الـ Chat ID بتاعه هنا (لو فاضي
                        هيبعت على الجروب).
                      </p>
                      <div className="space-y-2">
                        {team.sales.map((s) => (
                          <div key={s} className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground w-24 shrink-0">
                              {s}
                            </label>
                            <Input
                              value={salesChats[s] || ''}
                              onChange={(e) =>
                                setSalesChats((prev) => ({
                                  ...prev,
                                  [s]: e.target.value,
                                }))
                              }
                              placeholder="123456789"
                              className="bg-background border-border font-mono text-xs h-8"
                              dir="ltr"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-venom/15 flex items-center justify-center text-venom text-sm font-bold shrink-0">
                4
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">احفظ واختبر</h3>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-venom/20 text-venom border border-venom/30 hover:bg-venom/30"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                  ) : (
                    <Save className="w-4 h-4 ml-1.5" />
                  )}
                  حفظ الإعدادات
                </Button>
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  variant="outline"
                  className="border-venom/30 text-venom hover:bg-venom/10"
                >
                  {testing ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-1.5" />
                  ) : (
                    <Send className="w-4 h-4 ml-1.5" />
                  )}
                  إرسال رسالة اختبار
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-notifications info */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-venom" />
            🔔 إشعارات تلقائية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            البوت بيبعت رسالة تلقائياً في الحالات دي:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>✅ لما التيلي تحوّل عميل لسيلز</li>
            <li>❌ لما يتم حذف/إلغاء عميل</li>
            <li>📝 (قريباً) لما السيلز يغير حالة الصفقة</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
