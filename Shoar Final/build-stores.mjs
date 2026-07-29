/**
 * build-stores.mjs — شوركم
 * ═══════════════════════════════════════════════════════════════
 * الحل الجذري لمشكلة "Low value content": يولّد صفحة HTML ثابتة
 * لكل متجر، محتواها مكتوب في الملف قبل تشغيل أي JavaScript.
 *
 * الفكرة: يستخدم store.html نفسه كقالب — لا تكرار لمنطق التطبيق.
 * كل صفحة مولّدة تحتفظ بالتقييم والمصادقة وإرسال المراجعات كاملة،
 * لأنها تحمّل نفس السكربت الأصلي ثم "ترطّبه" (hydration).
 *
 * التشغيل:
 *   npm i @supabase/supabase-js
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node build-stores.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const SITE      = 'https://shoar.com.sa';
const TEMPLATE  = 'store.html';
const OUT_DIR   = 'store';
const MIN_REV   = 1;   // لا تولّد صفحة لمتجر بلا تقييمات — تفادياً للمحتوى الضعيف

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('✗ ناقص SUPABASE_URL أو SUPABASE_ANON_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ───────── أدوات ───────── */
const esc = (s = '') => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* الأسماء العربية تسبّب 404 على Vercel — لذلك نُحوّلها إلى حروف لاتينية */
const AR2LAT = {
  'ا':'a','أ':'a','إ':'i','آ':'aa','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
  'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','ة':'h',
  'و':'w','ؤ':'w','ي':'y','ى':'a','ئ':'y','ء':'','ﻻ':'la','لا':'la',
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
};

const translit = (s) => String(s || '')
  .replace(/[\u064B-\u0652\u0670]/g, '')        // حذف التشكيل
  .split('').map(ch => (ch in AR2LAT ? AR2LAT[ch] : ch)).join('');

const slugify = (name, id) => {
  const base = translit(name).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 45).replace(/^-|-$/g, '');
  return `${base || 'store'}-${String(id).slice(0, 8)}`;
};

const CAT = { store:'متجر', product:'منتج', service:'مزود خدمة',
              specialist:'اختصاصي', other:'أخرى' };
const stars = n => '★'.repeat(Math.round(n||0)) + '☆'.repeat(5 - Math.round(n||0));
const toAr  = n => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const fmtDate = d => { try { return new Date(d)
  .toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'}); }
  catch { return ''; } };

/* ───────── محتوى الصفحة المُسبق ───────── */
function renderMain(store, reviews) {
  const r  = parseFloat(store.avg_rating) || 0;
  const rc = store.review_count || 0;
  const cat = CAT[store.category] || store.category || '';

  const asp = { delivery:0, quality:0, support:0, value:0 };
  ['delivery','quality','support','value'].forEach(k => {
    const v = reviews.filter(x => x[k]).map(x => x[k]);
    asp[k] = v.length ? (v.reduce((a,b) => a+b, 0) / v.length).toFixed(1) : 0;
  });

  const links = [
    store.ig_handle ? `<a class="store-link" href="https://instagram.com/${esc(String(store.ig_handle).replace('@',''))}" rel="nofollow noopener" target="_blank">📸 ${esc(store.ig_handle)}</a>` : '',
    store.website   ? `<a class="store-link" href="${esc(String(store.website).startsWith('http') ? store.website : 'https://'+store.website)}" rel="nofollow noopener" target="_blank">🌐 الموقع</a>` : ''
  ].join('');

  const bars = [5,4,3,2,1].map(n =>
    `<div class="bar-row"><span class="bar-label">${n}★</span>`
    + `<div class="bar-track"><div class="bar-fill" style="width:${store['pct_'+n]||0}%"></div></div>`
    + `<span class="bar-pct">${store['pct_'+n]||0}%</span></div>`).join('');

  const aspects = (asp.delivery||asp.quality||asp.support||asp.value) ? `
    <div class="aspects">
      ${asp.delivery?`<div class="asp-card"><div class="asp-label">🚚 التوصيل</div><div class="asp-val">${asp.delivery}</div></div>`:''}
      ${asp.quality ?`<div class="asp-card"><div class="asp-label">📦 الجودة</div><div class="asp-val">${asp.quality}</div></div>`:''}
      ${asp.support ?`<div class="asp-card"><div class="asp-label">💬 الدعم</div><div class="asp-val">${asp.support}</div></div>`:''}
      ${asp.value   ?`<div class="asp-card"><div class="asp-label">💰 القيمة</div><div class="asp-val">${asp.value}</div></div>`:''}
    </div>` : '';

  const revs = reviews.length ? reviews.map(rv => `
    <div class="review-card">
      <div class="rev-head">
        <div class="rev-avatar">${esc((rv.author_name||'م')[0])}</div>
        <div><div class="rev-name">${esc(rv.author_name||'مستخدم موثّق')}</div>
        <div class="rev-date">${fmtDate(rv.created_at)}</div></div>
        <div class="rev-stars">${stars(rv.rating)} ${rv.rating}/5</div>
      </div>
      <div class="rev-body">${esc(rv.body||'')}</div>
      <div class="rev-aspects">
        ${rv.delivery?`<span class="rev-asp">🚚 ${rv.delivery}/5</span>`:''}
        ${rv.quality ?`<span class="rev-asp">📦 ${rv.quality}/5</span>`:''}
        ${rv.support ?`<span class="rev-asp">💬 ${rv.support}/5</span>`:''}
        ${rv.value   ?`<span class="rev-asp">💰 ${rv.value}/5</span>`:''}
      </div>
    </div>`).join('')
    : '<div class="empty">لا توجد تقييمات منشورة بعد لهذا المتجر.</div>';

  /* نص تحريري أصلي — يضمن محتوى حقيقي حتى لو التقييمات قليلة */
  const prose = `
    <section class="pr-sec">
      <h2>عن ${esc(store.name)}</h2>
      <p>${esc(store.name)} مُدرج في دليل شوركم ضمن فئة <strong>${esc(cat)}</strong>،
      ويحمل حالياً <strong>${toAr(rc)}</strong> ${rc === 1 ? 'تقييماً' : 'تقييماً'} من مستخدمين
      وثّقوا هوياتهم برقم جوال سعودي عبر رمز تحقق SMS. متوسط التقييم
      <strong>${r > 0 ? r : '—'} من ٥</strong>.</p>
      ${store.description ? `<p>${esc(store.description)}</p>` : ''}
      <p>التقييمات على شوركم تغطي أربعة محاور تُقاس كل واحدة على حدة: سرعة التوصيل،
      جودة المنتج، مستوى خدمة العملاء، والقيمة مقابل السعر. هذا التفصيل يفيدك أكثر من
      رقم واحد مجمّع، لأنه يكشف أين يتفوّق المتجر وأين يحتاج تحسيناً.</p>
    </section>

    <section class="pr-sec">
      <h2>كيف تقرأ هذه التقييمات؟</h2>
      <p><strong>لا تكتفِ بالمتوسط.</strong> راجع توزيع النجوم أعلاه: متجر بمتوسط ٤.٢
      وتقييمات متقاربة أفضل من متجر بمتوسط ٤.٥ نصف تقييماته نجمة واحدة والنصف الآخر خمس.</p>
      <p><strong>انتبه للتواريخ.</strong> التقييمات الحديثة تعكس الوضع الحالي للمتجر. متجر
      تحسّن كثيراً خلال سنة قد تسحب تقييماته القديمة متوسطه للأسفل بغير وجه حق، والعكس صحيح.</p>
      <p><strong>ابحث عن المشاكل المحلولة.</strong> التقييم الذي يذكر مشكلة ويشرح كيف تعامل
      معها المتجر أصدق مؤشر على المصداقية من غياب المشاكل تماماً. لا يوجد متجر بلا أخطاء —
      يوجد متجر يصلح أخطاءه ومتجر يتجاهلها.</p>
      <p>لمزيد من التفاصيل اقرأ
      <a href="../blog/how-to-verify-store-credibility.html">دليل التحقق من مصداقية أي متجر إلكتروني</a>،
      و<a href="../blog/signs-of-fake-reviews.html">علامات التقييمات المزيفة</a>.</p>
    </section>

    <section class="pr-sec">
      <h2>كيف نضمن أن التقييمات حقيقية؟</h2>
      <p>كل تقييم يأتي من حساب وثّق رقم جواله السعودي عبر رمز SMS، ولا يُسمح بأكثر من
      تقييم واحد لكل مستخدم على المتجر نفسه. <strong>لا نحذف التقييمات السلبية بناءً على
      طلب المتجر</strong> — نحذف فقط ما يخالف شروط الاستخدام: محتوى مسيء أو تشهيري أو
      لا يعود لتجربة شراء فعلية. المتجر يحق له الرد علناً على أي تقييم.</p>
      <p>هل عندك تجربة مع ${esc(store.name)}؟ اضغط زر التقييم في الأعلى وشاركها —
      تجربتك الواحدة قد توفّر على غيرك قراراً خاطئاً.</p>
    </section>

    <footer class="pr-foot">
      <div class="fl">
        <a href="../index.html">الرئيسية</a>
        <a href="../pages/category.html?cat=${esc(store.category||'')}">${esc(cat)}</a>
        <a href="../blog.html">المدونة</a>
        <a href="../pages/about.html">من نحن</a>
        <a href="../pages/contact.html">تواصل معنا</a>
        <a href="../pages/privacy.html">الخصوصية</a>
        <a href="../pages/terms.html">الشروط</a>
      </div>
      <div class="fb">© ٢٠٢٦ شوركم — جميع الحقوق محفوظة</div>
    </footer>`;

  return `
    <nav aria-label="مسار التصفح" style="font-size:13px;color:var(--mu);margin-bottom:14px;">
      <a href="../index.html" style="color:var(--mu);text-decoration:none;">الرئيسية</a> ←
      <a href="../pages/category.html?cat=${esc(store.category||'')}" style="color:var(--mu);text-decoration:none;">${esc(cat)}</a> ←
      <span>${esc(store.name)}</span>
    </nav>

    <div class="store-header">
      <div class="store-avatar">${esc((store.name||'م')[0])}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
          <h1 class="store-name">${esc(store.name)}</h1>
          ${store.verified ? '<span class="vbadge">★ موثّق</span>' : ''}
        </div>
        <div class="store-cat">${esc(cat)}</div>
        <div class="store-links">${links}</div>
      </div>
    </div>

    <div class="score-grid">
      <div class="big-score">
        <div class="score-num">${r > 0 ? r : '—'}</div>
        <div class="score-stars">${r > 0 ? stars(r) : ''}</div>
        <div class="score-count">${toAr(rc)} تقييم</div>
      </div>
      <div class="bars-wrap">${bars}</div>
    </div>
    ${aspects}

    <h2 style="font-size:19px;font-weight:700;margin:26px 0 12px;">
      ماذا قال العملاء عن ${esc(store.name)}؟</h2>
    ${revs}
    ${prose}`;
}

/* ───────── وسوم الرأس ───────── */
function renderHead(store, url, reviews) {
  const r  = parseFloat(store.avg_rating) || 0;
  const rc = store.review_count || 0;
  const cat = CAT[store.category] || store.category || '';
  const title = `${store.name} — ${toAr(rc)} تقييماً وآراء العملاء | شوركم`;
  const desc  = `${toAr(rc)} تقييماً موثّقاً لـ${store.name} بمتوسط ${r || '—'} من ٥. `
              + `اقرأ تجارب المشترين السعوديين في التوصيل والجودة والدعم قبل ما تشتري.`;
  const kw = [store.name, `تقييم ${store.name}`, `هل ${store.name} موثوق`,
    cat, 'تقييمات متاجر سعودية', 'شوركم', 'Shoarcom']
    .concat(store.keywords ? String(store.keywords).split(',').map(k => k.trim()) : [])
    .filter(Boolean).join(', ');

  const ld = { '@context':'https://schema.org', '@type':'LocalBusiness',
    name: store.name, url, description: store.description || desc,
    ...(store.website ? { sameAs:[store.website] } : {}),
    ...(rc > 0 ? { aggregateRating:{ '@type':'AggregateRating',
        ratingValue:r, reviewCount:rc, bestRating:5, worstRating:1 } } : {}),
    ...(reviews.length ? { review: reviews.slice(0,10).map(rv => ({
        '@type':'Review',
        author:{ '@type':'Person', name: rv.author_name || 'مستخدم موثّق' },
        datePublished:(rv.created_at||'').slice(0,10),
        reviewBody: rv.body || '',
        reviewRating:{ '@type':'Rating', ratingValue: rv.rating, bestRating:5, worstRating:1 }
      })) } : {})
  };

  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="${esc(kw)}">
<link rel="canonical" id="canonLink" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" id="ogUrl" content="${url}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>window.__STORE_ID__=${JSON.stringify(store.id)};window.__STORE_URL__=${JSON.stringify(url)};</script>`;
}

/* ───────── التنفيذ ───────── */
async function main() {
  const tpl = await readFile(TEMPLATE, 'utf8');
  if (!tpl.includes('<!--PRERENDER:HEAD-->'))
    throw new Error('القالب store.html غير مُهيَّأ — طبّق patch_store.py أولاً');

  console.log('→ سحب المتاجر من Supabase…');
  const { data: stores, error } = await db
    .from('stores_with_stats').select('*').eq('status','approved');
  if (error) throw error;

  const eligible = (stores||[]).filter(s => Number(s.review_count) >= MIN_REV);
  console.log(`  ${stores.length} معتمد · ${eligible.length} صالح للتوليد (${MIN_REV}+ تقييم)`);

  await rm(OUT_DIR, { recursive:true, force:true });
  await mkdir(OUT_DIR, { recursive:true });

  const urls = [], redirects = [];

  for (const store of eligible) {
    const { data: reviews } = await db.from('reviews')
      .select('*').eq('store_id', store.id).eq('status','approved')
      .order('created_at', { ascending:false }).limit(50);
    const rev  = reviews || [];
    const slug = slugify(store.name, store.id);
    const url  = `${SITE}/${OUT_DIR}/${slug}.html`;

    /* الرأس: نستبدل العلامة بوسوم حقيقية، ونحذف العناوين الافتراضية */
    let page = tpl
      .replace(/<title id="pageTitle">[\s\S]*?<\/title>\s*/, '')
      .replace(/<meta name="description" id="pageDesc"[^>]*>\s*/, '')
      .replace(/<meta property="og:title" id="ogTitle"[^>]*>\s*/, '')
      .replace(/<meta property="og:description" id="ogDesc"[^>]*>\s*/, '')
      .replace(/<meta name="keywords" id="pageKeywords"[^>]*>\s*/, '')
      .replace(/<link rel="canonical" id="canonLink"[^>]*>\s*/, '')
      .replace(/<meta property="og:url" id="ogUrl"[^>]*>\s*/, '')
      .replace('<!--PRERENDER:HEAD-->', renderHead(store, url, rev));

    /* الجسم: نملأ الحاوية بالمحتوى المُسبق */
    page = page.replace('<div class="container" id="main">',
      '<div class="container" id="main">' + renderMain(store, rev));

    /* الروابط النسبية: الصفحة داخل /store/ */
    page = page
      .replace(/href="index\.html"/g, 'href="../index.html"')
      .replace(/href="pages\//g, 'href="../pages/')
      .replace(/src="shoarlogo\.png"/g, 'src="../shoarlogo.png"')
      .replace(/href="shoarlogo\.png"/g, 'href="../shoarlogo.png"');

    await writeFile(path.join(OUT_DIR, `${slug}.html`), page, 'utf8');

    urls.push({ loc:url,
      lastmod:(rev[0]?.created_at || store.created_at || new Date().toISOString()).slice(0,10) });
    redirects.push({ source:'/store.html', has:[{type:'query',key:'id',value:store.id}],
      destination:`/${OUT_DIR}/${slug}.html`, permanent:true });

    console.log(`  ✓ ${slug}.html  (${rev.length} تقييم)`);
  }

  await writeSitemap(urls);
  await writeFile('vercel-redirects.json', JSON.stringify({ redirects }, null, 2), 'utf8');
  await writeFile(path.join(OUT_DIR, 'store-index.json'),
    JSON.stringify(eligible.map(s => ({ id:s.id, slug:slugify(s.name, s.id) })), null, 2), 'utf8');

  console.log(`\n✓ ${urls.length} صفحة + sitemap.xml + vercel-redirects.json`);
  if (urls.length < 20)
    console.warn('⚠ أقل من ٢٠ صفحة — يُفضّل الوصول لـ٢٠+ قبل إعادة طلب AdSense');
}

async function writeSitemap(storeUrls) {
  const stat = [
    ['/', '1.0', 'daily'], ['/pages/category.html','0.9','daily'],
    ['/blog.html','0.9','weekly'],
    ['/blog/how-to-verify-store-credibility.html','0.8','monthly'],
    ['/blog/signs-of-fake-reviews.html','0.8','monthly'],
    ['/blog/saudi-consumer-rights.html','0.8','monthly'],
    ['/blog/safe-shopping-instagram.html','0.8','monthly'],
    ['/blog/why-your-review-matters.html','0.8','monthly'],
    ['/pages/about.html','0.7','monthly'], ['/pages/contact.html','0.6','monthly'],
    ['/pages/privacy.html','0.5','monthly'], ['/pages/terms.html','0.5','monthly'],
  ].map(([u,p,f]) => `  <url><loc>${SITE}${u}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`);

  const dyn = storeUrls.map(u =>
    `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);

  await writeFile('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + stat.concat(dyn).join('\n') + `\n</urlset>\n`, 'utf8');
}

main().catch(e => { console.error('✗ فشل البناء:', e.message); process.exit(1); });
