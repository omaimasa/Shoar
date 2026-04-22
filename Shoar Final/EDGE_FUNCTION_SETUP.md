# إعداد Supabase Edge Function للذكاء الاصطناعي

## الخطوات (مرة واحدة فقط):

### 1. ثبّت Supabase CLI
```bash
npm install -g supabase
```

### 2. سجّل دخول
```bash
supabase login
```

### 3. اربط المشروع (استبدل برقم مشروعك)
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
رقم المشروع موجود في: Supabase → Settings → General → Reference ID

### 4. أضف Anthropic API Key كـ Secret
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXXXXXXXX
```
احصل على المفتاح من: console.anthropic.com → API Keys

### 5. انشر الـ Function
```bash
supabase functions deploy analyze
```

### 6. تحقق من النشر
في Supabase Dashboard → Edge Functions → يجب أن ترى "analyze" ✅

---

## بدون CLI (طريقة بديلة):
1. افتح Supabase → Edge Functions → New Function
2. اسمها: `analyze`
3. انسخ محتوى `supabase/functions/analyze/index.ts` والصقه
4. اذهب لـ Settings → Secrets → أضف `ANTHROPIC_API_KEY`
