import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteShell } from "@/components/site-shell"
import { isEnabledLocale } from "@/lib/i18n/config"
import { POLICY_VERSION } from "@/lib/policy"

type Props = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Какие данные собирает Portfolio+, зачем, где они хранятся и как их удалить.",
  alternates: { canonical: "/ru/privacy" },
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL

function formatVersion(version: string) {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-gray-300">{children}</div>
    </section>
  )
}

// The privacy policy, written for school students and their parents. Version
// is POLICY_VERSION: changing this text means changing that date, and then
// everyone is asked to agree again (lib/consent.ts).
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <SiteShell>
      <article className="container mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Политика конфиденциальности</h1>
          <p className="text-sm text-gray-400">Редакция от {formatVersion(POLICY_VERSION)}</p>
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-[15px] leading-relaxed text-gray-200">
            Коротко: без входа всё хранится только на вашем устройстве. После входа мы храним ваш email, заметки, избранное,
            портфолио и переписку с ИИ, чтобы они были на всех ваших устройствах. Мы ничего не продаём и не показываем
            рекламу. Скачать или удалить всё можно в любой момент: «Портфолио» → «Аккаунт».
          </p>
        </header>

        <Section title="Кто мы">
          <p>
            Portfolio+ — учебный исследовательский проект команды Team KAYA: каталог олимпиад, соревнований, волонтёрских
            программ и университетов для школьников Казахстана. Мы отвечаем за обработку данных, описанную ниже.
          </p>
        </Section>

        <Section title="Что мы собираем">
          <p>
            <strong className="text-white">Без входа</strong> — ничего о вас лично. Заметки сохраняются только в браузере
            на вашем устройстве. Мы считаем обезличенную статистику посещений (какие страницы открывают), без адресов
            поисковых запросов и без кодов входа.
          </p>
          <p>
            <strong className="text-white">После входа:</strong>
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>email — чтобы вы могли войти; при входе через Google Google передаёт нам и имя, но мы его не используем;</li>
            <li>ваш возраст (группа) и отметку о согласии родителя — этого требует закон;</li>
            <li>заметки, избранное, отметки «Я участвую» и записи портфолио;</li>
            <li>переписку с ИИ-помощником (последние 200 сообщений) и счётчик сообщений за день;</li>
            <li>подписку на уведомления, если вы включили напоминания о дедлайнах.</li>
          </ul>
        </Section>

        <Section title="Зачем">
          <p>
            Только чтобы сайт работал для вас: показывать ваши данные на всех ваших устройствах, напоминать о дедлайнах,
            отвечать на вопросы ИИ-помощника и не давать ботам тратить его лимит. Мы не продаём данные, не передаём их
            рекламодателям и не используем для рекламы.
          </p>
        </Section>

        <Section title="Согласие и возраст">
          <p>
            Перед входом мы спрашиваем возраст. Если вам меньше 18 лет, нужно согласие родителя или законного
            представителя — отметьте, что он знает о регистрации и согласен. Согласие можно отозвать, удалив аккаунт.
          </p>
          <p>
            ИИ-помощник доступен с 13 лет: таковы правила сервиса OpenAI. Каталог, избранное и портфолио работают в любом
            возрасте.
          </p>
        </Section>

        <Section title="Где хранятся данные и кому они передаются">
          <p>Мы пользуемся сервисами, которые находятся за пределами Казахстана. Дав согласие, вы соглашаетесь на эту передачу:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Supabase — база данных и вход (серверы в США);</li>
            <li>Vercel — сайт и обезличенная статистика посещений (США и ЕС);</li>
            <li>
              OpenAI — ответы ИИ-помощника (США). Получает ваши сообщения, а заметки — только если вы это включили. Не
              использует их для обучения и хранит до 30 дней для защиты от злоупотреблений;
            </li>
            <li>Google — если вы входите через Google;</li>
            <li>
              службы уведомлений браузеров (Apple, Google, Microsoft, Mozilla) — если вы включили напоминания. В уведомлении
              только название возможности и дата.
            </li>
          </ul>
        </Section>

        <Section title="Сколько мы храним">
          <p>
            Пока у вас есть аккаунт. Из переписки с ИИ хранятся только последние 200 сообщений. Когда вы удаляете аккаунт,
            сразу удаляется всё: заметки, переписка, избранное, портфолио, согласия и подписки на уведомления.
          </p>
        </Section>

        <Section title="Ваши права">
          <p>В разделе «Портфолио» → «Аккаунт» вы можете в любой момент:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>скачать все свои данные одним файлом;</li>
            <li>включить или выключить отправку заметок ИИ-помощнику;</li>
            <li>удалить аккаунт и всё, что с ним связано.</li>
          </ul>
          <p>Исправить заметки и записи портфолио можно прямо в приложении.</p>
        </Section>

        <Section title="Как мы защищаем данные">
          <p>
            Каждый видит только свои данные — это проверяет сама база данных, а не только сайт. Ключи доступа
            администраторов не попадают в браузер. Соединение всегда зашифровано.
          </p>
        </Section>

        <Section title="Если вы на общем компьютере">
          <p>
            На школьном или чужом компьютере выходите из аккаунта, когда закончите («Портфолио» → «Аккаунт» → «Выйти»). При
            выходе мы удаляем с компьютера сохранённые страницы и отключаем напоминания. Скачанный PDF портфолио удалите из
            папки «Загрузки».
          </p>
        </Section>

        <Section title="Изменения и связь">
          <p>
            Если эта политика изменится, мы попросим вашего согласия заново. Вопросы и просьбы о данных:{" "}
            {CONTACT ? (
              <a href={`mailto:${CONTACT}`} className="text-emerald-300 underline underline-offset-2">
                {CONTACT}
              </a>
            ) : (
              "через руководителя проекта Portfolio+ в вашей школе"
            )}
            .
          </p>
        </Section>
      </article>
    </SiteShell>
  )
}
