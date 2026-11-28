# Rasdiya: content for the esap.ai product page

This follows the same layout as the Zakra page (https://www.esap.ai/en/product/zakra), section by section, so each field can go straight into the same slot. All copy matches what rasdiya.health already says, and every number comes from the models' test results.

**Please keep the small print under the Outcomes metrics (§5).** Without it the numbers read as clinical claims we can't make.

**In this folder:** this document and 17 image files (§7). That is everything for this page. There is no video, so the Demo section uses five screenshots of the product walk-through, in English and Arabic (§3).

---

## 0. Page settings

| Field | EN | AR |
|---|---|---|
| Product name | Rasdiya | Rasdiya *(kept in Latin script)* |
| Slug | `/en/product/rasdiya` | `/ar/product/rasdiya` |
| SEO title | Rasdiya: Clinical Decision Support \| ESAP AI | Rasdiya: دعم القرار السريري \| ESAP AI |
| Meta description | Calibrated estimates at hospital admission (likely diagnoses, ICU, mortality, readmission, length of stay) with reasons a clinician can check. | تقديرات معايَرة عند إدخال المريض: التشخيصات المرجّحة، والعناية المركزة، والوفيات، وإعادة الإدخال، ومدة التنويم، مع أسباب يتحقق منها الطبيب. |
| OG image | `social-card-dark-1200x630.png` | same image |

---

## 1. Hero

| Field | EN | AR |
|---|---|---|
| Name | Rasdiya | Rasdiya |
| Sub-name | Clinical Decision Support | دعم القرار السريري |
| Tagline | Calibrated Estimates at Admission. The clinician decides. | تقديرات معايَرة عند الإدخال. والقرار للطبيب. |
| Button | Visit site → https://rasdiya.health | زيارة الموقع → https://rasdiya.health |

---

## 2. Problems, solutions and impact (ERR_01 to ERR_03)

Each card: problem title → one-line problem → impact metric → solution title → one-line solution.

### ERR_01

| Field | EN | AR |
|---|---|---|
| Problem title | Risk Becomes Clear Too Late | الخطر يتضح متأخرًا |
| Problem line | ICU need, mortality and long stays show up hours or days after admission. | الحاجة للعناية المركزة والوفاة وطول الإقامة تظهر بعد ساعات أو أيام من الإدخال. |
| Metric | 5 Estimates at Admission | 5 تقديرات عند الإدخال |
| Solution title | Admission-Time Estimates | تقديرات لحظة الإدخال |
| Solution line | Reads only what is known at admission and estimates diagnoses, ICU need, mortality, readmission and length of stay. | يقرأ ما هو معروف لحظة الإدخال فقط، ويقدّر التشخيصات ودخول العناية المركزة والوفاة وإعادة الإدخال ومدة التنويم. |

### ERR_02

| Field | EN | AR |
|---|---|---|
| Problem title | Black-Box Risk Scores | مؤشرات خطر مبهمة |
| Problem line | A number with no reasons and no sign of how far to trust it. | رقم بلا أسباب ولا ما يدل على مدى الثقة به. |
| Metric | 0.83 ICU AUROC\* | 0.83 AUROC للعناية المركزة\* |
| Solution title | Explained, Calibrated Results | نتائج مفسَّرة ومعايَرة |
| Solution line | Every estimate shows its drivers, calibration and limits. When the input is too thin, the badge is withheld. | يظهر مع كل تقدير عوامله ومعايرته وحدوده. وحين تكون المدخلات غير كافية تُحجب الشارة. |

### ERR_03

| Field | EN | AR |
|---|---|---|
| Problem title | Intake in One Language | إدخال بلغة واحدة |
| Problem line | Patients can't describe symptoms in their own words, or know when it can't wait. | لا يستطيع المريض وصف أعراضه بلغته، ولا معرفة متى لا تحتمل حالته الانتظار. |
| Metric | 2 Languages, Arabic + English | لغتان: العربية والإنجليزية |
| Solution title | Bilingual Intake Assistant | مساعد إدخال ثنائي اللغة |
| Solution line | Captures symptoms in Arabic or English. Chest pain or stroke signs bring up a 997 emergency message at once. | يلتقط الأعراض بالعربية أو الإنجليزية. ألم الصدر أو علامات السكتة تُظهر فورًا رسالة طوارئ للاتصال بـ 997. |

---

## 3. Demo

| Field | EN | AR |
|---|---|---|
| Heading | One Admission, Start to Finish | إدخال واحد، من البداية إلى النهاية |
| Line | Follow one patient from the door to the clinician's decision. | تابع مريضًا واحدًا من لحظة وصوله حتى قرار الطبيب. |

**Media:** no video. Use these five images as a slideshow or gallery, in this order. They are screenshots of the walk-through on rasdiya.health (2440 × 1220 each). Each already carries the site's note that the values are illustrative.

| # | Step | EN image | AR image |
|---|---|---|---|
| 1 | Arrival | `demo-01-arrival.png` | `demo-01-arrival-ar.png` |
| 2 | Intake | `demo-02-intake.png` | `demo-02-intake-ar.png` |
| 3 | Estimate | `demo-03-estimate.png` | `demo-03-estimate-ar.png` |
| 4 | Review | `demo-04-review.png` | `demo-04-review-ar.png` |
| 5 | Shared | `demo-05-shared.png` | `demo-05-shared-ar.png` |

If only one image fits, use `demo-03-estimate.png` (AR: `demo-03-estimate-ar.png`).

---

## 4. How it works (3 stages)

Each stage has a title and 3 to 5 short labels, as on the Zakra page.

| Field | EN | AR |
|---|---|---|
| Heading | How Rasdiya Works | كيف يعمل Rasdiya |
| Line | From admission data to a decision the clinician makes and the log records. | من بيانات الإدخال إلى قرار يتخذه الطبيب ويُسجَّل. |

| Stage | EN title | EN nodes | AR title | AR nodes |
|---|---|---|---|---|
| One | Admission Intake | Intake Form · Bilingual Assistant · Patient History · Admission Cut-off | الإدخال | نموذج الإدخال · المساعد ثنائي اللغة · التاريخ المرضي · لحظة الإدخال |
| Two | Model Core | Differential · ICU Risk · Mortality · Readmission · Length of Stay | النماذج | التشخيص التفريقي · خطر العناية المركزة · الوفاة · إعادة الإدخال · مدة التنويم |
| Three | Clinical Decision | Result Card · Drivers & Calibration · Clinician Decision · Audit Log | القرار السريري | بطاقة النتيجة · العوامل والمعايرة · قرار الطبيب · سجل التدقيق |

---

## 5. Outcomes (3 metrics)

| Field | EN | AR |
|---|---|---|
| Heading | Outcomes | النتائج |
| Line | Estimates you can check, from models tested on data they never saw. | تقديرات يمكن التحقق منها، من نماذج اختُبرت على بيانات لم ترها. |

| Value | EN label | AR label |
|---|---|---|
| 0.83\* | ICU Admission AUROC | AUROC دخول العناية المركزة |
| 0.80\* | Mortality AUROC | AUROC الوفاة في المستشفى |
| 0.2 pts\* | ICU Calibration Error | خطأ معايرة العناية المركزة |

**Small print, required directly under the metrics:**

- **EN:** \* Retrospective results on a held-out test set from MIMIC-IV (de-identified US hospital data). Not yet validated prospectively or on Saudi hospital data. Decision support only, not diagnosis.
- **AR:** \* نتائج استرجاعية على مجموعة اختبار منفصلة من MIMIC-IV (بيانات مستشفيات أمريكية مجهولة الهوية). لم يُتحقق منها بعد بشكل استباقي ولا على بيانات مستشفيات سعودية. أداة لدعم القرار، لا للتشخيص.

---

## 6. CTA

| Field | EN | AR |
|---|---|---|
| Heading | Ready to Try Rasdiya? | هل أنت مستعد لتجربة Rasdiya؟ |
| Line | Talk to us about a 90-day hospital pilot, or try it free at rasdiya.health. | تواصل معنا لتجربة في المستشفى لمدة 90 يومًا، أو جرّبه مجانًا على rasdiya.health. |
| Button | Get Started → `/en/contact?product=rasdiya` | ابدأ الآن → `/ar/contact?product=rasdiya` |

---

## 7. Assets

All 17 files come with this document.

| Use | File |
|---|---|
| OG image (1200 × 630) | `social-card-dark-1200x630.png` |
| Product icon (SVG) | `mark-dark.svg` |
| Product icon (PNG) | `mark-dark-1024.png` (1024 × 1024, transparent corners) |
| Logo (SVG), light mode | `lockup-horizontal-dark.svg` |
| Logo (PNG), light mode | `lockup-horizontal-dark-1200.png` (1200 × 400, transparent) |
| Logo (SVG), dark mode | `lockup-horizontal-light.svg` |
| Logo (PNG), dark mode | `lockup-horizontal-light-1200.png` (1200 × 400, transparent) |
| Demo images (EN + AR) | `demo-01` to `demo-05` (10 files), see §3 |

**Light and dark mode:** the logo text is dark in `lockup-horizontal-dark` and light in `lockup-horizontal-light`. Use `-dark` on light backgrounds and `-light` on dark backgrounds, and switch them with the site's theme, otherwise the word "Rasdiya" disappears. The product icon and the social card have their own dark tile, so they work in both modes unchanged.

These are the only assets for this page.
