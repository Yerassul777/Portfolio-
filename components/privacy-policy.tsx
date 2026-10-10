import type { ReactNode } from "react"
import { formatDeadline } from "@/lib/deadline"
import { HTML_LANG, type Locale } from "@/lib/i18n/config"
import { POLICY_VERSION } from "@/lib/policy"

// The privacy policy, written for school students and their parents, in the
// three languages of the site. Shown on /privacy and inside the sign-up form
// (components/consent.tsx), so it can be read before agreeing. Version is
// POLICY_VERSION: changing what it says (in any language) means changing that
// date, and then everyone is asked to agree again. The Russian text is the
// reference; the others translate it and need the same read-through.

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export function formatPolicyVersion(locale: Locale = "ru", version = POLICY_VERSION) {
  return formatDeadline(version, "long", HTML_LANG[locale])
}

/** A paragraph, optionally starting with a bold lead, or a bulleted list. */
type Block = string | { lead: string; text: string } | { list: string[] }
type Policy = {
  title: string
  edition: string
  summary: string
  sections: { title: string; blocks: Block[] }[]
  contactLead: string
  contactFallback: string
}

const POLICY: Record<Locale, Policy> = {
  ru: {
    title: "Политика конфиденциальности",
    edition: "Редакция от {date}",
    summary:
      "Коротко: без входа всё хранится только на вашем устройстве. После входа мы храним ваш email, дату рождения, профиль, заметки, избранное, портфолио и переписку с ИИ, чтобы они были на всех ваших устройствах. Мы ничего не продаём и не показываем рекламу. Удалить всё можно в любой момент: «Портфолио» → «Профиль».",
    sections: [
      {
        title: "Кто мы",
        blocks: [
          "Portfolio+ — учебный исследовательский проект команды Team KAYA: каталог олимпиад, соревнований, волонтёрских программ и университетов для школьников Казахстана. Мы отвечаем за обработку данных, описанную ниже.",
        ],
      },
      {
        title: "Что мы собираем",
        blocks: [
          { lead: "Без входа", text: " — ничего о вас лично. Заметки сохраняются только в браузере на вашем устройстве. Мы считаем обезличенную статистику посещений (какие страницы открывают), без поисковых запросов и без кодов входа." },
          { lead: "После входа:", text: "" },
          {
            list: [
              "email — чтобы вы могли войти; при входе через Google он передаёт нам и имя, но мы его не сохраняем;",
              "дату рождения и отметку о согласии родителя — этого требует закон;",
              "профиль, если вы его заполните: имя, никнейм, класс, город, интересы и цвет аватара. Все поля необязательны;",
              "заметки, избранное, отметки «Я участвую» и записи портфолио;",
              "фотографии сертификатов и грамот, если вы их прикрепили к портфолио;",
              "переписку с ИИ-помощником (последние 200 сообщений) и счётчик сообщений за день;",
              "подписку на уведомления, если вы включили напоминания о дедлайнах.",
            ],
          },
        ],
      },
      {
        title: "Зачем",
        blocks: [
          "Только чтобы сервис работал для вас: показывать ваши данные на всех ваших устройствах, напоминать о дедлайнах, отвечать на вопросы ИИ-помощника и не давать ботам тратить его лимит. Мы не продаём данные, не передаём их рекламодателям и не используем для рекламы.",
        ],
      },
      {
        title: "Согласие и возраст",
        blocks: [
          "При регистрации мы спрашиваем дату рождения. Если вам меньше 18 лет, нужно согласие родителя или законного представителя — отметьте, что он знает о регистрации и согласен. Изменить дату рождения потом можно только через нас. Согласие можно отозвать, удалив аккаунт.",
          "ИИ-помощник доступен с 13 лет: таковы правила сервиса OpenAI. Каталог, избранное и портфолио работают в любом возрасте.",
        ],
      },
      {
        title: "ИИ-помощник",
        blocks: [
          "Соглашаясь с этой политикой, вы соглашаетесь, что ваши вопросы ИИ-помощнику обрабатывает сервис OpenAI. Вместе с вопросом OpenAI получает поля профиля (имя или никнейм, класс, город, интересы), чтобы обращаться к вам и подбирать возможности. Заметки — только если вы это включили в профиле. Дату рождения и email OpenAI не получает.",
          "Не пишите ИИ-помощнику то, что нельзя показывать посторонним: ИИН, адрес, телефон, пароли.",
        ],
      },
      {
        title: "Фотографии сертификатов",
        blocks: [
          "Фото, которое вы прикрепили к записи портфолио, хранится в закрытом хранилище вашего аккаунта: открыть его можете только вы, по ссылке, которая действует час. Перед загрузкой приложение уменьшает фото и удаляет из него скрытые данные — место съёмки, модель телефона, время. Фото удаляется вместе с записью или аккаунтом.",
          "Если вы нажимаете «Сканировать», фото один раз отправляется в OpenAI, чтобы прочитать название, организатора, результат и дату. Перед первым сканированием мы спрашиваем отдельное согласие. OpenAI не хранит фото и не учится на нём; имя, школу, дату рождения и номера документов мы не извлекаем. Сканер доступен с 13 лет.",
        ],
      },
      {
        title: "Где хранятся данные и кому они передаются",
        blocks: [
          "Мы пользуемся сервисами, которые находятся за пределами Казахстана. Дав согласие, вы соглашаетесь на эту передачу:",
          {
            list: [
              "Supabase — база данных и вход (серверы в США);",
              "Vercel — сайт и обезличенная статистика посещений (США и ЕС);",
              "OpenAI — ответы ИИ-помощника (США). Не использует ваши сообщения для обучения и хранит их до 30 дней для защиты от злоупотреблений;",
              "Google — если вы входите через Google;",
              "службы уведомлений браузеров (Apple, Google, Microsoft, Mozilla) — если вы включили напоминания. В уведомлении только название возможности и дата.",
            ],
          },
        ],
      },
      {
        title: "Сколько мы храним",
        blocks: [
          "Пока у вас есть аккаунт. Из переписки с ИИ хранятся только последние 200 сообщений. Когда вы удаляете аккаунт, сразу удаляется всё: профиль, заметки, переписка, избранное, портфолио с фотографиями сертификатов, согласия и подписки на уведомления.",
        ],
      },
      {
        title: "Ваши права",
        blocks: [
          "В разделе «Портфолио» → «Профиль» вы можете в любой момент:",
          { list: ["изменить или стереть поля профиля;", "включить или выключить отправку заметок ИИ-помощнику;", "удалить аккаунт и всё, что с ним связано."] },
          "Исправить заметки и записи портфолио можно прямо в приложении. Копию всех своих данных можно запросить у нас.",
        ],
      },
      {
        title: "Как мы защищаем данные",
        blocks: [
          "Каждый видит только свои данные — это проверяет сама база данных, а не только сайт. Ключи доступа администраторов не попадают в браузер. Соединение всегда зашифровано.",
        ],
      },
      {
        title: "Если вы на общем компьютере",
        blocks: [
          "На школьном или чужом компьютере выходите из аккаунта, когда закончите («Портфолио» → «Профиль» → «Выйти»). При выходе мы удаляем с компьютера сохранённые страницы и отключаем напоминания. Скачанный PDF портфолио удалите из папки «Загрузки».",
        ],
      },
    ],
    contactLead: "Если эта политика изменится, мы попросим вашего согласия заново. Вопросы и просьбы о данных: ",
    contactFallback: "через руководителя проекта Portfolio+ в вашей школе",
  },
  kz: {
    title: "Құпиялылық саясаты",
    edition: "{date} редакциясы",
    summary:
      "Қысқаша: кірмей пайдалансаңыз, бәрі тек сіздің құрылғыңызда сақталады. Кіргеннен кейін email-іңізді, туған күніңізді, профиліңізді, жазбаларыңызды, таңдаулыны, портфолионы және ЖИ-мен хат алмасуды барлық құрылғыларыңызда болуы үшін сақтаймыз. Біз ештеңе сатпаймыз және жарнама көрсетпейміз. Бәрін кез келген уақытта жоюға болады: «Портфолио» → «Профиль».",
    sections: [
      {
        title: "Біз кімбіз",
        blocks: [
          "Portfolio+ — Team KAYA командасының оқу-зерттеу жобасы: Қазақстан оқушыларына арналған олимпиадалар, жарыстар, волонтерлік бағдарламалар және университеттер каталогы. Төменде сипатталған деректерді өңдеуге біз жауаптымыз.",
        ],
      },
      {
        title: "Біз нені жинаймыз",
        blocks: [
          { lead: "Кірмесеңіз", text: " — сіз туралы жеке ештеңе жинамаймыз. Жазбалар тек құрылғыңыздағы браузерде сақталады. Біз кірулердің иесіз статистикасын (қандай беттер ашылатынын) іздеу сұрауларынсыз және кіру кодтарынсыз есептейміз." },
          { lead: "Кіргеннен кейін:", text: "" },
          {
            list: [
              "email — кіре алуыңыз үшін; Google арқылы кірсеңіз, ол бізге атыңызды да береді, бірақ біз оны сақтамаймыз;",
              "туған күніңіз бен ата-ана келісімі туралы белгі — мұны заң талап етеді;",
              "профиль, егер толтырсаңыз: аты, никнейм, сынып, қала, қызығушылықтар және аватар түсі. Барлық өріс міндетті емес;",
              "жазбалар, таңдаулы, «Қатысамын» белгілері және портфолио жазбалары;",
              "портфолиоға тіркеген сертификаттар мен мадақтамалардың фотолары;",
              "ЖИ көмекшімен хат алмасу (соңғы 200 хабарлама) және күндік хабарламалар саны;",
              "дедлайн туралы еске салғыштарды қоссаңыз — хабарламаларға жазылым.",
            ],
          },
        ],
      },
      {
        title: "Не үшін",
        blocks: [
          "Тек сервис сіз үшін жұмыс істеуі үшін: деректеріңізді барлық құрылғыларыңызда көрсету, дедлайндарды еске салу, ЖИ көмекшінің сұрақтарға жауап беруі және боттардың оның лимитін жұмсамауы үшін. Біз деректерді сатпаймыз, жарнама берушілерге бермейміз және жарнама үшін пайдаланбаймыз.",
        ],
      },
      {
        title: "Келісім және жас",
        blocks: [
          "Тіркелу кезінде туған күніңізді сұраймыз. 18 жасқа толмасаңыз, ата-анаңыздың немесе заңды өкіліңіздің келісімі қажет — оның тіркелу туралы білетінін және келісетінін белгілеңіз. Туған күнді кейін тек біз арқылы өзгертуге болады. Келісімді аккаунтты жою арқылы кері қайтарып алуға болады.",
          "ЖИ көмекші 13 жастан бастап қолжетімді: бұл OpenAI сервисінің ережесі. Каталог, таңдаулы және портфолио кез келген жаста жұмыс істейді.",
        ],
      },
      {
        title: "ЖИ көмекші",
        blocks: [
          "Осы саясатпен келісе отырып, ЖИ көмекшіге қойған сұрақтарыңызды OpenAI сервисі өңдейтініне келісесіз. Сұрақпен бірге OpenAI сізге жүгіну және мүмкіндіктерді іріктеу үшін профиль өрістерін (аты немесе никнейм, сынып, қала, қызығушылықтар) алады. Жазбаларды — тек профильде қоссаңыз ғана. Туған күніңізді және email-іңізді OpenAI алмайды.",
          "ЖИ көмекшіге бөгде адамдарға көрсетуге болмайтын нәрселерді жазбаңыз: ЖСН, мекенжай, телефон, құпиясөздер.",
        ],
      },
      {
        title: "Сертификат фотолары",
        blocks: [
          "Портфолио жазбасына тіркеген фото аккаунтыңыздың жабық қоймасында сақталады: оны бір сағат жарамды сілтеме арқылы тек сіз аша аласыз. Жүктер алдында қосымша фотоны кішірейтіп, одан жасырын деректерді — түсірілген орнын, телефон моделін, уақытын жояды. Фото жазбамен немесе аккаунтпен бірге жойылады.",
          "«Сканерлеу» батырмасын бассаңыз, фото атауын, ұйымдастырушысын, нәтижесін және күнін оқу үшін бір рет OpenAI-ға жіберіледі. Алғашқы сканерлеу алдында бөлек келісім сұраймыз. OpenAI фотоны сақтамайды және ол арқылы үйренбейді; аты-жөніңізді, мектебіңізді, туған күніңізді және құжат нөмірлерін біз алмаймыз. Сканер 13 жастан бастап қолжетімді.",
        ],
      },
      {
        title: "Деректер қайда сақталады және кімге беріледі",
        blocks: [
          "Біз Қазақстаннан тыс орналасқан сервистерді пайдаланамыз. Келісім бере отырып, осы беруге келісесіз:",
          {
            list: [
              "Supabase — дерекқор және кіру (серверлер АҚШ-та);",
              "Vercel — сайт және кірулердің иесіз статистикасы (АҚШ және ЕО);",
              "OpenAI — ЖИ көмекшінің жауаптары (АҚШ). Хабарламаларыңызды оқыту үшін пайдаланбайды және теріс пайдаланудан қорғау үшін 30 күнге дейін сақтайды;",
              "Google — Google арқылы кірсеңіз;",
              "браузерлердің хабарлама қызметтері (Apple, Google, Microsoft, Mozilla) — еске салғыштарды қоссаңыз. Хабарламада тек мүмкіндіктің атауы мен күні болады.",
            ],
          },
        ],
      },
      {
        title: "Қанша уақыт сақтаймыз",
        blocks: [
          "Аккаунтыңыз бар болғанша. ЖИ-мен хат алмасудан тек соңғы 200 хабарлама сақталады. Аккаунтты жойғанда бәрі бірден жойылады: профиль, жазбалар, хат алмасу, таңдаулы, сертификат фотолары бар портфолио, келісімдер және хабарламаларға жазылымдар.",
        ],
      },
      {
        title: "Сіздің құқықтарыңыз",
        blocks: [
          "«Портфолио» → «Профиль» бөлімінде кез келген уақытта:",
          { list: ["профиль өрістерін өзгертуге немесе өшіруге;", "жазбаларды ЖИ көмекшіге жіберуді қосуға немесе өшіруге;", "аккаунтты және онымен байланысты барлығын жоюға болады."] },
          "Жазбалар мен портфолио жазбаларын қосымшаның өзінде түзетуге болады. Барлық деректеріңіздің көшірмесін бізден сұрауға болады.",
        ],
      },
      {
        title: "Деректерді қалай қорғаймыз",
        blocks: [
          "Әркім тек өз деректерін көреді — мұны сайт қана емес, дерекқордың өзі тексереді. Әкімшілердің кіру кілттері браузерге түспейді. Байланыс әрқашан шифрланған.",
        ],
      },
      {
        title: "Ортақ компьютерде болсаңыз",
        blocks: [
          "Мектептегі немесе бөгде компьютерде жұмысты аяқтағанда аккаунттан шығыңыз («Портфолио» → «Профиль» → «Шығу»). Шыққанда компьютерден сақталған беттерді жоямыз және еске салғыштарды өшіреміз. Жүктелген портфолио PDF файлын «Жүктеулер» қалтасынан жойыңыз.",
        ],
      },
    ],
    contactLead: "Бұл саясат өзгерсе, келісіміңізді қайта сұраймыз. Деректер туралы сұрақтар мен өтініштер: ",
    contactFallback: "мектебіңіздегі Portfolio+ жобасының жетекшісі арқылы",
  },
  en: {
    title: "Privacy policy",
    edition: "Version of {date}",
    summary:
      "In short: without signing in, everything stays on your device. After you sign in we keep your email, date of birth, profile, notes, favourites, portfolio and AI chat so they are on all your devices. We sell nothing and show no ads. You can delete everything at any time: Portfolio → Profile.",
    sections: [
      {
        title: "Who we are",
        blocks: [
          "Portfolio+ is a school research project by Team KAYA: a catalogue of olympiads, competitions, volunteer programmes and universities for school students in Kazakhstan. We are responsible for the data processing described below.",
        ],
      },
      {
        title: "What we collect",
        blocks: [
          { lead: "Without signing in", text: " — nothing about you personally. Notes are kept only in the browser on your device. We count anonymous visit statistics (which pages are opened), without search queries and without sign-in codes." },
          { lead: "After signing in:", text: "" },
          {
            list: [
              "your email, so you can sign in; when you sign in with Google it also gives us your name, but we do not store it;",
              "your date of birth and a parent's-consent mark — the law requires this;",
              "your profile, if you fill it in: name, nickname, grade, city, interests and avatar colour. All fields are optional;",
              "notes, favourites, “I'm taking part” marks and portfolio entries;",
              "photos of certificates and diplomas, if you attach them to your portfolio;",
              "your chat with the AI assistant (the last 200 messages) and a daily message counter;",
              "a notification subscription, if you turn on deadline reminders.",
            ],
          },
        ],
      },
      {
        title: "Why",
        blocks: [
          "Only so that the service works for you: showing your data on all your devices, reminding you of deadlines, answering your questions to the AI assistant and keeping bots from using up its limit. We do not sell data, do not pass it to advertisers and do not use it for advertising.",
        ],
      },
      {
        title: "Consent and age",
        blocks: [
          "When you sign up we ask for your date of birth. If you are under 18, you need the consent of a parent or legal guardian — tick that they know about the sign-up and agree. The date of birth can later be changed only through us. You can withdraw consent by deleting your account.",
          "The AI assistant is available from the age of 13: those are OpenAI's rules. The catalogue, favourites and portfolio work at any age.",
        ],
      },
      {
        title: "AI assistant",
        blocks: [
          "By accepting this policy you agree that your questions to the AI assistant are processed by OpenAI. With each question OpenAI receives your profile fields (name or nickname, grade, city, interests) so it can address you and match opportunities. Your notes only if you turned that on in your profile. OpenAI does not receive your date of birth or email.",
          "Do not write to the AI assistant anything that strangers must not see: your ID number (IIN), address, phone, passwords.",
        ],
      },
      {
        title: "Certificate photos",
        blocks: [
          "A photo you attach to a portfolio entry is kept in your account's private storage: only you can open it, through a link that works for an hour. Before uploading, the app shrinks the photo and removes hidden data from it — where it was taken, the phone model, the time. The photo is deleted together with the entry or the account.",
          "If you press “Scan”, the photo is sent to OpenAI once to read the title, organiser, result and date. Before the first scan we ask for separate consent. OpenAI does not keep the photo or train on it; we do not extract your name, school, date of birth or document numbers. The scanner is available from the age of 13.",
        ],
      },
      {
        title: "Where data is stored and who receives it",
        blocks: [
          "We use services located outside Kazakhstan. By giving consent you agree to this transfer:",
          {
            list: [
              "Supabase — database and sign-in (servers in the USA);",
              "Vercel — the website and anonymous visit statistics (USA and EU);",
              "OpenAI — the AI assistant's answers (USA). It does not use your messages for training and keeps them for up to 30 days to prevent abuse;",
              "Google — if you sign in with Google;",
              "browser notification services (Apple, Google, Microsoft, Mozilla) — if you turned on reminders. A notification contains only the opportunity's title and date.",
            ],
          },
        ],
      },
      {
        title: "How long we keep it",
        blocks: [
          "As long as you have an account. Only the last 200 messages of the AI chat are kept. When you delete your account, everything is deleted at once: profile, notes, chat, favourites, portfolio with certificate photos, consents and notification subscriptions.",
        ],
      },
      {
        title: "Your rights",
        blocks: [
          "In Portfolio → Profile you can at any time:",
          { list: ["change or clear your profile fields;", "turn sharing your notes with the AI assistant on or off;", "delete your account and everything linked to it."] },
          "You can correct notes and portfolio entries right in the app. You can ask us for a copy of all your data.",
        ],
      },
      {
        title: "How we protect data",
        blocks: [
          "Everyone sees only their own data — the database itself checks this, not just the website. Administrators' access keys never reach the browser. The connection is always encrypted.",
        ],
      },
      {
        title: "On a shared computer",
        blocks: [
          "On a school or someone else's computer, sign out when you are done (Portfolio → Profile → Sign out). When you sign out we delete the saved pages from the computer and turn off reminders. Delete a downloaded portfolio PDF from the Downloads folder.",
        ],
      },
    ],
    contactLead: "If this policy changes, we will ask for your consent again. Questions and requests about your data: ",
    contactFallback: "through the Portfolio+ project lead at your school",
  },
}

export function policyTitle(locale: Locale): string {
  return POLICY[locale].title
}

export function policyEdition(locale: Locale): string {
  return POLICY[locale].edition.replace("{date}", formatPolicyVersion(locale))
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-gray-300">{children}</div>
    </section>
  )
}

export function PrivacyPolicyBody({ locale = "ru" }: { locale?: Locale }) {
  const policy = POLICY[locale]
  return (
    <div data-selectable lang={HTML_LANG[locale]} className="space-y-10 break-words">
      <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-[15px] leading-relaxed text-gray-200">{policy.summary}</p>
      {policy.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.blocks.map((block, i) =>
            typeof block === "string" ? (
              <p key={i}>{block}</p>
            ) : "list" in block ? (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>
                <strong className="text-white">{block.lead}</strong>
                {block.text}
              </p>
            )
          )}
        </Section>
      ))}
      <Section title={locale === "ru" ? "Изменения и связь" : locale === "kz" ? "Өзгерістер және байланыс" : "Changes and contact"}>
        <p>
          {policy.contactLead}
          {CONTACT ? (
            <a href={`mailto:${CONTACT}`} className="text-emerald-300 underline underline-offset-2">
              {CONTACT}
            </a>
          ) : (
            policy.contactFallback
          )}
          .
        </p>
      </Section>
    </div>
  )
}
