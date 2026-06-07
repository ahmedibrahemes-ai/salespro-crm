'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  Bot,
  MessageCircle,
  HelpCircle,
} from 'lucide-react'
import {
  useCrmStore,
  CONTACT_RESULTS,
  SALES_STATUSES,
  ATTENDANCE_STATUSES,
  formatDate,
  formatRelativeTime,
  getDateRange,
} from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ===== Storage Keys =====
const STORAGE_KEY_TOKEN = 'telegram_bot_token'
const STORAGE_KEY_CHAT = 'telegram_chat_id'

// ===== Main Component =====
export function TelegramSetup() {
  const { currentUser } = useCrmStore()
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  // Load saved config
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN)
    const savedChat = localStorage.getItem(STORAGE_KEY_CHAT)
    if (savedToken) setBotToken(savedToken)
    if (savedChat) setChatId(savedChat)
    if (savedToken && savedChat) setConnected(true)
  }, [])

  // Save config
  const handleSave = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    setSaving(true)
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, botToken.trim())
      localStorage.setItem(STORAGE_KEY_CHAT, chatId.trim())
      setConnected(true)
      toast.success('تم حفظ الإعدادات بنجاح')
    } catch {
      toast.error('فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  // Test connection
  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('يرجى ملء جميع الحقول أولاً')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: '🐍 Venom CRM - اختبار الاتصال\nتم الاتصال بنجاح! ✅',
            parse_mode: 'Markdown',
          }),
        }
      )

      const data = await response.json()
      if (data.ok) {
        setTestResult('success')
        toast.success('تم إرسال رسالة الاختبار بنجاح!')
      } else {
        setTestResult('error')
        toast.error(`فشل: ${data.description || 'خطأ غير معروف'}`)
      }
    } catch (err) {
      setTestResult('error')
      toast.error('فشل في الاتصال بالبوت')
    } finally {
      setTesting(false)
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('تم النسخ')
  }

  if (!currentUser) return null

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold venom-text-glow text-venom">إعداد التليجرام</h1>
        <p className="text-muted-foreground mt-1">ربط إشعارات التليجرام للنظام</p>
      </motion.div>

      {/* Connection Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="bg-card border border-border overflow-hidden">
          <div className={`h-1 ${connected ? 'bg-gradient-to-l from-emerald-500 to-venom' : 'bg-gradient-to-l from-red-500 to-amber-500'}`} />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full ${connected ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                {connected ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div>
                <p className="font-semibold">{connected ? 'متصل' : 'غير متصل'}</p>
                <p className="text-xs text-muted-foreground">
                  {connected ? 'البوت مُعد وجاهز للإرسال' : 'يرجى إعداد البوت أدناه'}
                </p>
              </div>
              {testResult && (
                <Badge
                  className={`mr-auto ${
                    testResult === 'success'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {testResult === 'success' ? '✅ نجح الاختبار' : '❌ فشل الاختبار'}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Setup Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-venom" />
              إعدادات البوت
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bot Token */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Bot Token</label>
              <div className="relative">
                <Input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
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

            {/* Chat ID */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Chat ID</label>
              <div className="relative">
                <Input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="bg-background border-border pr-10 font-mono text-sm"
                  dir="ltr"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-venom"
                  onClick={() => copyToClipboard(chatId)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-venom/20 text-venom border-venom/30 hover:bg-venom/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                حفظ الإعدادات
              </Button>
              <Button
                onClick={handleTest}
                disabled={testing}
                variant="outline"
                className="border-venom/30 text-venom hover:bg-venom/10"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                اختبار الاتصال
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step-by-step Guide */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-venom-purple" />
              دليل الإعداد خطوة بخطوة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              {
                step: 1,
                title: 'إنشاء بوت جديد',
                description: 'افتح تليجرام وابحث عن @BotFather ثم أرسل /newbot',
                code: '/newbot',
              },
              {
                step: 2,
                title: 'اختر اسم البوت',
                description: 'أدخل اسم عرض للبوت مثل "Venom CRM Bot"',
                code: null,
              },
              {
                step: 3,
                title: 'اختر يوزرنيم البوت',
                description: 'أدخل يوزرنيم ينتهي بـ bot مثل "venom_crm_bot"',
                code: null,
              },
              {
                step: 4,
                title: 'انسخ الـ Token',
                description: 'سيُرسل لك BotFather الـ Token، انسخه والصقه أعلاه',
                code: null,
              },
              {
                step: 5,
                title: 'احصل على Chat ID',
                description: 'أضف البوت لمجموعتك أو أرسل له رسالة، ثم استخدم هذا الرابط:',
                code: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`,
              },
              {
                step: 6,
                title: 'اختبر الاتصال',
                description: 'اضغط على "اختبار الاتصال" للتأكد من أن كل شيء يعمل',
                code: null,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-venom/15 flex items-center justify-center text-venom text-sm font-bold shrink-0">
                    {item.step}
                  </div>
                  {i < 5 && <div className="w-px h-full bg-venom/20 mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  {item.code && (
                    <div className="mt-2 relative group">
                      <pre
                        className="bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto"
                        dir="ltr"
                      >
                        {item.code}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute left-2 top-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-venom"
                        onClick={() => copyToClipboard(item.code!)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Useful Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-venom" />
              روابط مفيدة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'BotFather', url: 'https://t.me/BotFather', desc: 'إنشاء وإدارة البوتات' },
                { label: 'RawDataBot', url: 'https://t.me/RawDataBot', desc: 'الحصول على Chat ID' },
                { label: 'Telegram API Docs', url: 'https://core.telegram.org/bots/api', desc: 'توثيق API الرسمي' },
                { label: 'getUpdates', url: '#', desc: 'عرض آخر الرسائل' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-venom/30 hover:bg-venom/5 transition-all group"
                >
                  <MessageCircle className="w-4 h-4 text-venom shrink-0" />
                  <div>
                    <p className="text-sm font-medium group-hover:text-venom transition-colors">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground">{link.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
