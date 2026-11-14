/**
 * Privacy Policy and Terms, in English and Arabic (QA issues 3 and 14).
 *
 * Written for a Saudi deployment first: the Personal Data Protection Law
 * (PDPL) and its implementing regulations, SDAIA as the authority, Saudi
 * governing law, a Data Protection Officer contact, and an honest statement
 * that this demonstration is not yet hosted in Saudi Arabia.
 *
 * Both languages are drafts. Counsel has not reviewed them, and a native
 * Arabic speaker with legal background must review the Arabic before use.
 */

export type Block = { p: string } | { ul: string[] };
export type LegalSection = { id: string; title: string; blocks: Block[] };
export type LegalText = {
  eyebrow: string;
  title: string;
  lede: string;
  summary: string[];
  sections: LegalSection[];
};

export const EFFECTIVE = { en: "10 November 2026", ar: "10 نوفمبر 2026" };
export const VERSION = { en: "Draft 1.0", ar: "مسودة 1.0" };

const PRIVACY_EN: LegalText = {
  eyebrow: "Privacy Policy",
  title: "How ESAP Clinical AI handles personal and health data.",
  lede: "What we collect, why, who can see it, where it is kept, and how to use your rights under the Saudi Personal Data Protection Law.",
  summary: [
    "When a hospital uses ESAP, the hospital decides how your data is used (it is the controller). ESAP processes it on the hospital's instructions.",
    "Health data is sensitive personal data under the Saudi PDPL. We never sell it, and we never use it for advertising.",
    "This demonstration is not hosted in Saudi Arabia and must only be used with synthetic data. Real patient data will be hosted in the Kingdom.",
    "Race, insurance and marital status are never model inputs. They are used only to check the models are fair.",
    "You can see, copy, correct and delete your data, and withdraw consent, from the patient portal or by writing to our Data Protection Officer.",
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are and what this covers",
      blocks: [
        { p: "ESAP Clinical AI (\"ESAP\", \"we\") is clinical decision-support software. It gives clinicians estimates at the time a patient is admitted to hospital. It does not diagnose and does not make treatment decisions." },
        { p: "This policy covers the ESAP website, the clinician and administrator workspaces, and the patient portal." },
      ],
    },
    {
      id: "roles",
      title: "Who is responsible for your data",
      blocks: [
        { p: "When a hospital uses ESAP, the hospital is the controller of your personal data and ESAP is its processor. We act only on the hospital's documented instructions, under a data processing agreement." },
        { p: "When you open an individual account yourself (a solo clinician or a patient without a hospital), ESAP is the controller of the data in that account." },
      ],
    },
    {
      id: "law",
      title: "The law that applies",
      blocks: [
        { p: "In the Kingdom of Saudi Arabia, ESAP follows the Personal Data Protection Law (Royal Decree No. M/19 of 9/2/1443H, as amended by Royal Decree No. M/148 of 5/9/1444H), its Implementing Regulations, and the Regulation on Personal Data Transfer outside the Kingdom. The Saudi Data & AI Authority (SDAIA) is the competent authority." },
        { p: "Health data is sensitive personal data under the PDPL and gets the stricter protections the law requires. Where a hospital outside Saudi Arabia uses ESAP, its own local law also applies through its agreement with us." },
      ],
    },
    {
      id: "what-we-collect",
      title: "What we collect",
      blocks: [
        { ul: [
          "Account details: name, email, role, and for clinicians the licence number you give us.",
          "What clinicians enter at admission: age, sex, how the patient arrived, vital signs, early lab results, prior conditions, medicines and notes.",
          "What patients send through the portal: answers to the intake form, questions, requests, sharing and consent choices.",
          "Records of use: who opened or changed which record and when (the audit log), and sign-in events.",
          "Technical data needed to keep you signed in safely: a session cookie and your IP address in the audit log.",
        ] },
        { p: "Race, insurance and marital status may be recorded by the hospital. ESAP never uses them as inputs to any model. They are used only to check that the models work equally well for different groups." },
      ],
    },
    {
      id: "how-we-use",
      title: "Why we use it",
      blocks: [
        { ul: [
          "To provide the service the hospital asked for: running the decision-support models and showing results to the care team.",
          "To keep the service secure, and to keep the access log the law and the hospital require.",
          "With your consent, for the optional purposes in your portal settings: letting the AI tool be used for you, checking the models are fair and accurate (with your name removed), and approved research (with your name removed). You can say no, or change your mind, at any time. Each choice is recorded with its date and policy version.",
        ] },
        { p: "We never sell personal data, never use it for advertising, and never train models on a hospital's patients without a separate written agreement with that hospital." },
      ],
    },
    {
      id: "sharing",
      title: "Who can see it",
      blocks: [
        { ul: [
          "Your care team, according to their role. Each role sees only what it needs.",
          "People you choose to share with from the portal, such as a family member. You can stop this at any time.",
          "ESAP staff have no standing access to patient records. Emergency access needs a reason and a ticket, is time-limited and is logged.",
          "Service providers who host or run the service for us, under contracts that bind them to the same rules. We publish the list before any pilot with real patient data.",
        ] },
      ],
    },
    {
      id: "hosting",
      title: "Where your data is kept",
      blocks: [
        { p: "This demonstration build is not hosted in Saudi Arabia: the website is served by Vercel and the server runs outside the Kingdom. That is why it must only be used with synthetic data." },
        { p: "Before any pilot with real patient data, ESAP will keep personal data in Saudi Arabia, in a data centre licensed by the Communications, Space & Technology Commission (CST), and will not transfer it outside the Kingdom except as the PDPL transfer regulation allows." },
      ],
    },
    {
      id: "security",
      title: "How we protect it",
      blocks: [
        { p: "Built today: role-based access checked on the server, a log of every read and change, a session cookie that page scripts cannot read, sign-out after 30 minutes without activity, and a lock after repeated wrong passwords. Two-factor sign-in is planned, not built." },
        { p: "Still planned: encryption at rest, an independent penetration test, tamper-evident audit storage and automated backups. The Security page lists what is built and what is planned." },
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      blocks: [
        { ul: [
          "Portal account data: until you close the account. Closing it deletes your sign-in, your form answers and your settings straight away.",
          "Assessment results: for the period the hospital sets (six years by default), then deleted.",
          "The access log: six years, then deleted.",
          "Password-reset links: deleted seven days after they expire.",
        ] },
        { p: "A purge runs every day and writes a report of what it deleted. The hospital's own medical record is kept by the hospital under its own legal duties." },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      blocks: [
        { p: "Under the PDPL you have the right to:" },
        { ul: [
          "Be told how your data is used (this policy).",
          "See your data and get a copy. The portal's export includes your record, your form answers, your requests, your consent choices and who looked at your record.",
          "Ask for it to be corrected.",
          "Ask for it to be destroyed when it is no longer needed. Closing your portal account does this for the portal.",
          "Withdraw consent you gave, from your portal settings.",
          "Complain to SDAIA if you think your data has been mishandled.",
        ] },
        { p: "We answer requests within 30 days. For data a hospital holds, the hospital's own privacy officer acts on the request; we help them." },
      ],
    },
    {
      id: "breaches",
      title: "If something goes wrong",
      blocks: [
        { p: "If personal data is exposed, ESAP tells the affected hospital within 24 hours of becoming aware, so the hospital can notify SDAIA within the 72 hours the PDPL requires. People affected are told without undue delay when the breach is likely to harm them." },
      ],
    },
    {
      id: "dpo",
      title: "Data Protection Officer",
      blocks: [
        { p: "You can reach ESAP's Data Protection Officer at dpo@esap.ai. The DPO's name will be published here before any pilot with real patient data." },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and storage",
      blocks: [
        { p: "We use one strictly necessary cookie to keep you signed in. Your browser also stores your theme and language. There are no advertising or tracking cookies." },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        { p: "Patient portal accounts are for people aged 18 or over. A parent or carer can be given access to a child's information through family access." },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        { p: "We will tell you about any material change at least 30 days before it applies. When a change affects something you consented to, the portal asks you to choose again." },
      ],
    },
  ],
};

const PRIVACY_AR: LegalText = {
  eyebrow: "سياسة الخصوصية",
  title: "كيف تتعامل ESAP Clinical AI مع البيانات الشخصية والصحية.",
  lede: "ما الذي نجمعه، ولماذا، ومن يمكنه رؤيته، وأين يُحفظ، وكيف تمارس حقوقك بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية.",
  summary: [
    "عندما يستخدم مستشفى ESAP، يحدد المستشفى كيفية استخدام بياناتك (فهو جهة التحكم)، وتعالجها ESAP وفق تعليماته.",
    "البيانات الصحية بيانات شخصية حساسة بموجب نظام حماية البيانات الشخصية. لا نبيعها أبدًا، ولا نستخدمها في الإعلانات.",
    "هذا الإصدار التجريبي غير مستضاف في المملكة العربية السعودية، ويجب ألا يُستخدم إلا ببيانات اصطناعية. ستُستضاف بيانات المرضى الحقيقية داخل المملكة.",
    "العِرق والتأمين والحالة الاجتماعية ليست مدخلات للنماذج أبدًا، وتُستخدم فقط للتحقق من عدالة النماذج.",
    "يمكنك الاطلاع على بياناتك ونسخها وتصحيحها وحذفها وسحب موافقتك، من بوابة المريض أو بمراسلة مسؤول حماية البيانات لدينا.",
  ],
  sections: [
    {
      id: "who-we-are",
      title: "من نحن وما الذي تشمله هذه السياسة",
      blocks: [
        { p: "ESAP Clinical AI (\"ESAP\" أو \"نحن\") برنامج لدعم القرار السريري، يقدّم للأطباء تقديرات وقت دخول المريض إلى المستشفى. لا يشخّص ولا يتخذ قرارات العلاج." },
        { p: "تشمل هذه السياسة موقع ESAP، ومساحات عمل الأطباء والمسؤولين، وبوابة المريض." },
      ],
    },
    {
      id: "roles",
      title: "من المسؤول عن بياناتك",
      blocks: [
        { p: "عندما يستخدم مستشفى ESAP، يكون المستشفى جهة التحكم في بياناتك الشخصية وتكون ESAP جهة المعالجة لديه. نعمل فقط وفق تعليمات المستشفى الموثّقة، بموجب اتفاقية معالجة بيانات." },
        { p: "عندما تفتح حسابًا فرديًا بنفسك (طبيب مستقل أو مريض غير مرتبط بمستشفى)، تكون ESAP جهة التحكم في بيانات ذلك الحساب." },
      ],
    },
    {
      id: "law",
      title: "النظام المطبّق",
      blocks: [
        { p: "في المملكة العربية السعودية، تلتزم ESAP بنظام حماية البيانات الشخصية (الصادر بالمرسوم الملكي رقم م/19 وتاريخ 9/2/1443هـ والمعدّل بالمرسوم الملكي رقم م/148 وتاريخ 5/9/1444هـ) ولائحته التنفيذية ولائحة نقل البيانات الشخصية خارج المملكة. والهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) هي الجهة المختصة." },
        { p: "البيانات الصحية بيانات شخصية حساسة بموجب النظام، وتحظى بالحماية الأشد التي يتطلبها. وعندما يستخدم ESAP مستشفى خارج المملكة، ينطبق أيضًا نظامه المحلي من خلال اتفاقيته معنا." },
      ],
    },
    {
      id: "what-we-collect",
      title: "ما الذي نجمعه",
      blocks: [
        { ul: [
          "بيانات الحساب: الاسم والبريد الإلكتروني والدور، ورقم الترخيص الذي يقدّمه الطبيب.",
          "ما يُدخله الأطباء عند الدخول: العمر والجنس وطريقة الوصول والعلامات الحيوية ونتائج التحاليل المبكرة والحالات السابقة والأدوية والملاحظات.",
          "ما يرسله المرضى عبر البوابة: إجابات نموذج الاستقبال والأسئلة والطلبات وخيارات المشاركة والموافقة.",
          "سجلات الاستخدام: من فتح أي سجل أو غيّره ومتى (سجل التدقيق)، وأحداث تسجيل الدخول.",
          "البيانات التقنية اللازمة لإبقائك مسجّل الدخول بأمان: ملف تعريف ارتباط للجلسة وعنوان IP في سجل التدقيق.",
        ] },
        { p: "قد يسجّل المستشفى العِرق والتأمين والحالة الاجتماعية. لا تستخدمها ESAP أبدًا مدخلاتٍ لأي نموذج، وتُستخدم فقط للتحقق من أن النماذج تعمل بالقدر نفسه لمختلف الفئات." },
      ],
    },
    {
      id: "how-we-use",
      title: "لماذا نستخدمها",
      blocks: [
        { ul: [
          "لتقديم الخدمة التي طلبها المستشفى: تشغيل نماذج دعم القرار وعرض النتائج على فريق الرعاية.",
          "للحفاظ على أمان الخدمة، والاحتفاظ بسجل الاطلاع الذي يتطلبه النظام والمستشفى.",
          "بموافقتك، للأغراض الاختيارية في إعدادات بوابتك: السماح باستخدام أداة الذكاء الاصطناعي معك، والتحقق من عدالة النماذج ودقتها (بعد حذف اسمك)، والأبحاث المعتمدة (بعد حذف اسمك). يمكنك الرفض أو تغيير رأيك في أي وقت، ويُسجَّل كل اختيار مع تاريخه وإصدار السياسة.",
        ] },
        { p: "لا نبيع البيانات الشخصية أبدًا، ولا نستخدمها في الإعلانات، ولا ندرّب النماذج على مرضى مستشفى دون اتفاق مكتوب منفصل معه." },
      ],
    },
    {
      id: "sharing",
      title: "من يمكنه رؤيتها",
      blocks: [
        { ul: [
          "فريق رعايتك، وفق دور كل منهم، فلا يرى كل دور إلا ما يحتاجه.",
          "من تختار مشاركتهم من البوابة، مثل أحد أفراد عائلتك، ويمكنك إيقاف ذلك في أي وقت.",
          "ليس لموظفي ESAP اطلاع دائم على سجلات المرضى. والاطلاع الطارئ يتطلب سببًا وتذكرة، ومحدود بوقت، ومسجَّل.",
          "مقدّمو الخدمات الذين يستضيفون الخدمة أو يشغّلونها لصالحنا، بموجب عقود تلزمهم بالقواعد نفسها. سننشر قائمتهم قبل أي تجربة ببيانات مرضى حقيقية.",
        ] },
      ],
    },
    {
      id: "hosting",
      title: "أين تُحفظ بياناتك",
      blocks: [
        { p: "هذا الإصدار التجريبي غير مستضاف في المملكة العربية السعودية: يقدّم الموقعَ Vercel ويعمل الخادم خارج المملكة، ولهذا يجب ألا يُستخدم إلا ببيانات اصطناعية." },
        { p: "قبل أي تجربة ببيانات مرضى حقيقية، ستحفظ ESAP البيانات الشخصية داخل المملكة العربية السعودية، في مركز بيانات مرخّص من هيئة الاتصالات والفضاء والتقنية، ولن تنقلها خارج المملكة إلا وفق ما تسمح به لائحة نقل البيانات." },
      ],
    },
    {
      id: "security",
      title: "كيف نحميها",
      blocks: [
        { p: "المتوفر اليوم: صلاحيات حسب الدور يتحقق منها الخادم، وسجل لكل اطلاع وتغيير، وملف ارتباط للجلسة لا تستطيع سكربتات الصفحة قراءته، وتسجيل الخروج بعد 30 دقيقة دون نشاط، وقفل الحساب بعد تكرار كلمة المرور الخاطئة. أما التحقق بخطوتين فهو مخطط له ولم يُبنَ بعد." },
        { p: "ما زال مخططًا: التشفير أثناء التخزين، واختبار اختراق مستقل، وتخزين للسجل يكشف أي تلاعب، والنسخ الاحتياطي الآلي. تعرض صفحة الأمان ما هو متوفر وما هو مخطط." },
      ],
    },
    {
      id: "retention",
      title: "مدة الاحتفاظ",
      blocks: [
        { ul: [
          "بيانات حساب البوابة: إلى أن تغلق الحساب. ويؤدي إغلاقه إلى حذف بيانات دخولك وإجاباتك في النماذج وإعداداتك فورًا.",
          "نتائج التقييم: للمدة التي يحددها المستشفى (ست سنوات افتراضيًا)، ثم تُحذف.",
          "سجل الاطلاع: ست سنوات، ثم يُحذف.",
          "روابط إعادة تعيين كلمة المرور: تُحذف بعد سبعة أيام من انتهاء صلاحيتها.",
        ] },
        { p: "تعمل عملية حذف يوميًا وتكتب تقريرًا بما حذفته. أما السجل الطبي في المستشفى فيحتفظ به المستشفى وفق التزاماته النظامية." },
      ],
    },
    {
      id: "rights",
      title: "حقوقك",
      blocks: [
        { p: "بموجب نظام حماية البيانات الشخصية، لك الحق في:" },
        { ul: [
          "أن تُبلَّغ بكيفية استخدام بياناتك (هذه السياسة).",
          "الاطلاع على بياناتك والحصول على نسخة منها. ويشمل التصدير من البوابة سجلك وإجاباتك في النماذج وطلباتك وخيارات موافقتك ومن اطّلع على سجلك.",
          "طلب تصحيحها.",
          "طلب إتلافها عند انتفاء الحاجة إليها، وإغلاق حساب البوابة يحقق ذلك بالنسبة للبوابة.",
          "سحب موافقتك من إعدادات بوابتك.",
          "تقديم شكوى إلى سدايا إذا رأيت أن بياناتك عولجت على نحو غير سليم.",
        ] },
        { p: "نرد على الطلبات خلال 30 يومًا. وبالنسبة للبيانات التي يحتفظ بها مستشفى، ينفّذ مسؤول الخصوصية في المستشفى الطلب ونحن نساعده." },
      ],
    },
    {
      id: "breaches",
      title: "إذا حدث خلل",
      blocks: [
        { p: "إذا تعرّضت بيانات شخصية للكشف، تُبلغ ESAP المستشفى المتأثر خلال 24 ساعة من علمها، ليتمكن المستشفى من إبلاغ سدايا خلال 72 ساعة كما يشترط النظام. ويُبلَّغ المتأثرون دون تأخير غير مبرر متى كان الخلل مرجّحًا أن يضرّهم." },
      ],
    },
    {
      id: "dpo",
      title: "مسؤول حماية البيانات",
      blocks: [
        { p: "يمكنك التواصل مع مسؤول حماية البيانات في ESAP على dpo@esap.ai. وسيُنشر اسمه هنا قبل أي تجربة ببيانات مرضى حقيقية." },
      ],
    },
    {
      id: "cookies",
      title: "ملفات الارتباط والتخزين",
      blocks: [
        { p: "نستخدم ملف ارتباط واحدًا ضروريًا لإبقائك مسجّل الدخول، ويحفظ متصفحك أيضًا المظهر واللغة. لا توجد ملفات ارتباط للإعلانات أو التتبع." },
      ],
    },
    {
      id: "children",
      title: "الأطفال",
      blocks: [
        { p: "حسابات بوابة المريض لمن بلغوا 18 عامًا فأكثر. ويمكن منح أحد الوالدين أو مقدّم الرعاية صلاحية الاطلاع على معلومات الطفل عبر وصول العائلة." },
      ],
    },
    {
      id: "changes",
      title: "التغييرات على هذه السياسة",
      blocks: [
        { p: "سنبلغك بأي تغيير جوهري قبل تطبيقه بثلاثين يومًا على الأقل. وعندما يمسّ التغيير أمرًا وافقت عليه، تطلب منك البوابة الاختيار من جديد." },
      ],
    },
  ],
};

const TERMS_EN: LegalText = {
  eyebrow: "Terms & Conditions",
  title: "The terms for using ESAP Clinical AI.",
  lede: "What ESAP Clinical AI is for, who may use it, and what each side is responsible for, starting with the most important part: it supports clinical judgement and never replaces it.",
  summary: [
    "ESAP is decision support for clinicians. It is not medical advice and it does not diagnose.",
    "This is a demonstration. Use synthetic data only, and never enter real patient information.",
    "The models in this build are placeholders. Their numbers are not calibrated and must not inform care.",
    "The clinician stays responsible for every clinical decision.",
    "These terms are governed by the laws of the Kingdom of Saudi Arabia.",
  ],
  sections: [
    {
      id: "acceptance",
      title: "Accepting these terms",
      blocks: [
        { p: "By creating an account or using ESAP Clinical AI you accept these terms. A hospital's signed agreement with ESAP, including its data processing agreement, takes precedence over these terms for that hospital's users." },
      ],
    },
    {
      id: "not-medical-advice",
      title: "Decision support, not medical advice",
      blocks: [
        { p: "ESAP gives estimates to help a clinician think. It does not diagnose, does not decide treatment, and is not a substitute for clinical judgement. Patients should not act on anything in the portal without their care team." },
        { p: "ESAP has not been registered with or reviewed by the Saudi Food and Drug Authority (SFDA) or any other regulator. Whether each model is a medical device is being assessed." },
      ],
    },
    {
      id: "saudi-approvals",
      title: "Saudi registrations and approvals",
      blocks: [
        { p: "ESAP is preparing to serve hospitals in the Kingdom of Saudi Arabia. The registrations and approvals below are planned. None of them is held yet, and each will be listed here as it is granted." },
        { ul: [
          "A Saudi legal entity or a licensed Authorised Representative (MISA, Saudi Business Center).",
          "Hosting inside Saudi Arabia with a CST-licensed cloud provider, or on the hospital's own servers.",
          "Cybersecurity controls assessed against NCA ECC and CCC, with an external penetration test.",
          "Registration with SDAIA under the PDPL, with a named Data Protection Officer.",
          "Research ethics approval through the partner hospital's NCBE-registered IRB for a silent pilot.",
          "Medical device marketing authorisation (MDMA) from the SFDA, through the GHAD system.",
          "Clinician accounts verified against SCFHS licences.",
        ] },
        { p: "Until the SFDA grants marketing authorisation, ESAP's estimates will not be used to inform the care of real patients." },
      ],
    },
    {
      id: "demo",
      title: "This is a demonstration",
      blocks: [
        { p: "This build is for demonstration only. It must be used with synthetic data. Do not enter real patient information. The models are placeholders, not trained models, and their numbers are not calibrated." },
      ],
    },
    {
      id: "eligibility",
      title: "Who may use it",
      blocks: [
        { ul: [
          "Clinician accounts are for licensed health professionals. In Saudi Arabia that means registration with the Saudi Commission for Health Specialties.",
          "Patient accounts are for people aged 18 or over.",
          "Hospital staff accounts are created by the hospital's administrator.",
        ] },
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        { ul: [
          "Use only your own account, and keep your password and second factor to yourself.",
          "Open only the records you need for the care you are giving.",
          "Do not try to get round access controls, test the service's security without written permission, or overload it.",
          "Do not use ESAP to build a competing product or to re-identify people from anonymised data.",
        ] },
      ],
    },
    {
      id: "clinical-responsibility",
      title: "Clinical responsibility",
      blocks: [
        { p: "The treating clinician is responsible for every clinical decision, including whether to use an estimate at all. A hospital is responsible for its own clinical governance of the tool." },
      ],
    },
    {
      id: "data",
      title: "Data",
      blocks: [
        { p: "How we handle personal data is set out in the Privacy Policy. For a hospital's patients, the hospital decides how their data is used and ESAP follows its instructions." },
      ],
    },
    {
      id: "ip",
      title: "Intellectual property",
      blocks: [
        { p: "ESAP owns the software and the models. A hospital owns its data. Using ESAP gives you a licence to use the service under these terms, nothing more." },
      ],
    },
    {
      id: "availability",
      title: "Availability",
      blocks: [
        { p: "The demonstration is provided as it is, without a service-level commitment. It may change or stop without notice. A hospital's agreement sets any commitment for a pilot or production service." },
      ],
    },
    {
      id: "liability",
      title: "Liability",
      blocks: [
        { p: "To the extent the laws of Saudi Arabia allow, ESAP is not liable for decisions made using its estimates or for losses from using the demonstration. Nothing in these terms limits liability that cannot legally be limited." },
      ],
    },
    {
      id: "termination",
      title: "Ending your account",
      blocks: [
        { p: "You can close an individual account at any time from its settings. Closing it deletes your sign-in, your form answers and your settings straight away, so download anything you want to keep first. The access log and any hospital record stay in place, because the law requires it." },
      ],
    },
    {
      id: "law",
      title: "Governing law and disputes",
      blocks: [
        { p: "These terms are governed by the laws of the Kingdom of Saudi Arabia. Disputes go to the competent courts in Riyadh, unless a hospital's agreement with ESAP says otherwise." },
        { p: "We will give at least 30 days' notice of any material change to these terms. Both the Arabic and the English text are drafts; once counsel has reviewed them, the Arabic text will prevail if the two differ." },
      ],
    },
  ],
};

const TERMS_AR: LegalText = {
  eyebrow: "الشروط والأحكام",
  title: "شروط استخدام ESAP Clinical AI.",
  lede: "الغرض من ESAP Clinical AI، ومن يحق له استخدامه، ومسؤولية كل طرف، بدءًا بالأهم: أنه يدعم الحكم السريري ولا يحلّ محلّه أبدًا.",
  summary: [
    "ESAP أداة لدعم قرار الأطباء، وليست استشارة طبية، ولا تشخّص.",
    "هذا إصدار تجريبي. استخدم بيانات اصطناعية فقط، ولا تُدخل معلومات مرضى حقيقية أبدًا.",
    "النماذج في هذا الإصدار نماذج مؤقتة، وأرقامها غير معايرة ويجب ألا تُبنى عليها الرعاية.",
    "يبقى الطبيب مسؤولًا عن كل قرار سريري.",
    "تخضع هذه الشروط لأنظمة المملكة العربية السعودية.",
  ],
  sections: [
    {
      id: "acceptance",
      title: "قبول هذه الشروط",
      blocks: [
        { p: "بإنشاء حساب أو استخدام ESAP Clinical AI فإنك تقبل هذه الشروط. وتتقدّم اتفاقية المستشفى الموقّعة مع ESAP، بما فيها اتفاقية معالجة البيانات، على هذه الشروط بالنسبة لمستخدمي ذلك المستشفى." },
      ],
    },
    {
      id: "not-medical-advice",
      title: "دعم للقرار وليس استشارة طبية",
      blocks: [
        { p: "تقدّم ESAP تقديرات تساعد الطبيب على التفكير. لا تشخّص، ولا تقرر العلاج، ولا تغني عن الحكم السريري. وينبغي ألا يتصرف المرضى بناءً على أي شيء في البوابة دون فريق رعايتهم." },
        { p: "لم تُسجَّل ESAP لدى الهيئة العامة للغذاء والدواء ولم تراجعها أي جهة رقابية. ويجري تقييم ما إذا كان كل نموذج يُعدّ جهازًا طبيًا." },
      ],
    },
    {
      id: "saudi-approvals",
      title: "التسجيلات والموافقات في المملكة العربية السعودية",
      blocks: [
        { p: "تستعد ESAP لخدمة المستشفيات في المملكة العربية السعودية. التسجيلات والموافقات أدناه مخطط لها، ولم يُحصل على أي منها بعد، وستُدرج هنا كلٌّ منها عند منحها." },
        { ul: [
          "كيان قانوني سعودي أو ممثل معتمد مرخّص (وزارة الاستثمار، المركز السعودي للأعمال).",
          "استضافة داخل المملكة لدى مزوّد سحابي مرخّص من هيئة الاتصالات والفضاء والتقنية، أو على خوادم المستشفى نفسه.",
          "ضوابط أمن سيبراني مُقيَّمة وفق الضوابط الأساسية وضوابط الحوسبة السحابية للهيئة الوطنية للأمن السيبراني، مع اختبار اختراق خارجي.",
          "التسجيل لدى سدايا بموجب نظام حماية البيانات الشخصية، مع تسمية مسؤول حماية البيانات.",
          "موافقة أخلاقيات البحث عبر لجنة المستشفى الشريك المسجّلة لدى اللجنة الوطنية للأخلاقيات الحيوية، لتجربة صامتة.",
          "إذن تسويق جهاز طبي من الهيئة العامة للغذاء والدواء عبر نظام غد.",
          "التحقق من حسابات الأطباء مقابل تراخيص الهيئة السعودية للتخصصات الصحية.",
        ] },
        { p: "إلى أن تمنح الهيئة العامة للغذاء والدواء إذن التسويق، لن تُستخدم تقديرات ESAP في رعاية مرضى حقيقيين." },
      ],
    },
    {
      id: "demo",
      title: "هذا إصدار تجريبي",
      blocks: [
        { p: "هذا الإصدار للعرض فقط، ويجب استخدامه ببيانات اصطناعية. لا تُدخل معلومات مرضى حقيقية. النماذج مؤقتة وليست مدرّبة، وأرقامها غير معايرة." },
      ],
    },
    {
      id: "eligibility",
      title: "من يحق له الاستخدام",
      blocks: [
        { ul: [
          "حسابات الأطباء للممارسين الصحيين المرخّصين، وفي المملكة يعني ذلك التسجيل لدى الهيئة السعودية للتخصصات الصحية.",
          "حسابات المرضى لمن بلغوا 18 عامًا فأكثر.",
          "ينشئ مسؤول المستشفى حسابات موظفيه.",
        ] },
      ],
    },
    {
      id: "acceptable-use",
      title: "الاستخدام المقبول",
      blocks: [
        { ul: [
          "استخدم حسابك فقط، واحتفظ بكلمة مرورك وعامل التحقق الثاني لنفسك.",
          "لا تفتح إلا السجلات التي تحتاجها للرعاية التي تقدّمها.",
          "لا تحاول تجاوز ضوابط الوصول، ولا تختبر أمان الخدمة دون إذن مكتوب، ولا تُثقل عليها.",
          "لا تستخدم ESAP لبناء منتج منافس، ولا لإعادة التعرّف على الأشخاص من بيانات مجهّلة.",
        ] },
      ],
    },
    {
      id: "clinical-responsibility",
      title: "المسؤولية السريرية",
      blocks: [
        { p: "الطبيب المعالج مسؤول عن كل قرار سريري، بما في ذلك قرار استخدام التقدير من عدمه. والمستشفى مسؤول عن الحوكمة السريرية لاستخدام الأداة لديه." },
      ],
    },
    {
      id: "data",
      title: "البيانات",
      blocks: [
        { p: "توضّح سياسة الخصوصية كيف نتعامل مع البيانات الشخصية. وبالنسبة لمرضى المستشفى، يحدد المستشفى كيفية استخدام بياناتهم وتلتزم ESAP بتعليماته." },
      ],
    },
    {
      id: "ip",
      title: "الملكية الفكرية",
      blocks: [
        { p: "تملك ESAP البرنامج والنماذج، ويملك المستشفى بياناته. ويمنحك استخدام ESAP ترخيصًا باستخدام الخدمة وفق هذه الشروط فحسب." },
      ],
    },
    {
      id: "availability",
      title: "التوافر",
      blocks: [
        { p: "يُقدَّم الإصدار التجريبي كما هو، دون التزام بمستوى خدمة، وقد يتغير أو يتوقف دون إشعار. وتحدد اتفاقية المستشفى أي التزام لخدمة تجريبية أو تشغيلية." },
      ],
    },
    {
      id: "liability",
      title: "المسؤولية",
      blocks: [
        { p: "في الحدود التي تسمح بها أنظمة المملكة العربية السعودية، لا تتحمل ESAP المسؤولية عن القرارات المتخذة بناءً على تقديراتها ولا عن الخسائر الناتجة عن استخدام الإصدار التجريبي. ولا يحدّ أي شيء في هذه الشروط من مسؤولية لا يجوز نظامًا الحدّ منها." },
      ],
    },
    {
      id: "termination",
      title: "إنهاء حسابك",
      blocks: [
        { p: "يمكنك إغلاق الحساب الفردي في أي وقت من إعداداته. ويؤدي إغلاقه إلى حذف بيانات دخولك وإجاباتك في النماذج وإعداداتك فورًا، لذا نزّل ما تريد الاحتفاظ به أولًا. ويبقى سجل الاطلاع وأي سجل لدى المستشفى، لأن النظام يتطلب ذلك." },
      ],
    },
    {
      id: "law",
      title: "النظام الحاكم والنزاعات",
      blocks: [
        { p: "تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتُحال النزاعات إلى المحاكم المختصة في الرياض، ما لم تنص اتفاقية المستشفى مع ESAP على غير ذلك." },
        { p: "سنبلغك بأي تغيير جوهري على هذه الشروط قبل ثلاثين يومًا على الأقل. والنصان العربي والإنجليزي مسودتان، وبعد مراجعتهما من مستشار قانوني يكون النص العربي هو المعتمد عند الاختلاف." },
      ],
    },
  ],
};

export const LEGAL = {
  privacy: { en: PRIVACY_EN, ar: PRIVACY_AR },
  terms: { en: TERMS_EN, ar: TERMS_AR },
};

/** Fixed interface text around the two documents. */
export const LEGAL_UI = {
  en: {
    effective: "Effective", onThisPage: "On this page", shortVersion: "The short version",
    draftTitle: "Draft — not yet reviewed by counsel",
    draftBody: "This text describes how the demonstration build is designed to behave. It has not been reviewed by a lawyer and is not a contract. A hospital's signed agreement and data processing agreement take precedence over anything written here.",
    contact: "Questions about this document go to the ESAP Data Protection Officer at dpo@esap.ai. If a hospital treats you, its own privacy officer is usually the quickest route.",
    readPrivacy: "Read the Privacy Policy", readTerms: "Read the Terms & Conditions",
  },
  ar: {
    effective: "يسري من", onThisPage: "في هذه الصفحة", shortVersion: "باختصار",
    draftTitle: "مسودة — لم يراجعها مستشار قانوني بعد",
    draftBody: "يصف هذا النص كيف صُمّم الإصدار التجريبي ليعمل. لم يراجعه محامٍ وليس عقدًا. وتتقدّم اتفاقية المستشفى الموقّعة واتفاقية معالجة البيانات على أي شيء مكتوب هنا.",
    contact: "توجَّه الأسئلة حول هذا المستند إلى مسؤول حماية البيانات في ESAP على dpo@esap.ai. وإذا كان مستشفى يعالجك، فمسؤول الخصوصية لديه هو غالبًا الطريق الأسرع.",
    readPrivacy: "اقرأ سياسة الخصوصية", readTerms: "اقرأ الشروط والأحكام",
  },
};
