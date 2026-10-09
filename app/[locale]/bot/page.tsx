import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteShell } from "@/components/site-shell"
import { isEnabledLocale } from "@/lib/i18n/config"

// Linked from the crawler's User-Agent (lib/ingest/web.ts): what the bot is,
// what it reads, and how a site owner can stop it.

export const metadata: Metadata = {
  title: "Portfolio+Bot",
  description: "Робот Portfolio+: что он читает на сайтах и как его остановить.",
  alternates: { canonical: "/ru/bot" },
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export default async function BotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-3xl min-w-0 space-y-6 break-words px-4 py-12 text-[15px] leading-relaxed text-gray-300 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Portfolio+Bot</h1>
        <p>
          Portfolio+ — учебный проект команды Team KAYA: каталог олимпиад, конкурсов, волонтёрских программ и университетов
          для школьников Казахстана. Чтобы каталог не устаревал, раз в день наш робот читает несколько сайтов организаторов и
          ищет новые возможности. Всё найденное сначала проверяет человек, и только потом оно появляется в каталоге со ссылкой
          на источник.
        </p>
        <h2 className="text-xl font-semibold text-white">Как он себя ведёт</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>представляется как «Portfolio+Bot» со ссылкой на эту страницу;</li>
          <li>соблюдает robots.txt — правила для «*» и для «Portfolio+Bot»;</li>
          <li>открывает только страницы мероприятий с выбранных сайтов, не больше 20 новых за раз и не чаще раза в секунду;</li>
          <li>одну и ту же страницу перечитывает не чаще раза в месяц;</li>
          <li>не заполняет формы, не входит в аккаунты и не собирает персональные данные.</li>
        </ul>
        <h2 className="text-xl font-semibold text-white">Как его остановить</h2>
        <p>Добавьте в robots.txt вашего сайта:</p>
        <pre className="overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#0d1210] p-4 text-sm text-emerald-200">
          {"User-agent: Portfolio+Bot\nDisallow: /"}
        </pre>
        <p>
          Или напишите нам{CONTACT ? ": " : " через руководителя проекта Portfolio+"}
          {CONTACT && (
            <a href={`mailto:${CONTACT}`} className="text-emerald-300 underline underline-offset-2">
              {CONTACT}
            </a>
          )}
          . Если ваш материал оказался в каталоге по ошибке, мы уберём его.
        </p>
      </article>
    </SiteShell>
  )
}
