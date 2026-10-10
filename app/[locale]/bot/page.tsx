import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteShell } from "@/components/site-shell"
import { isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { localeAlternates } from "@/lib/metadata"

// Linked from the crawler's User-Agent (lib/ingest/web.ts): what the bot is,
// what it reads, and how a site owner can stop it.

const COPY: Record<Locale, { description: string; intro: string; behaviour: string; rules: string[]; stop: string; addRobots: string; write: string; writeFallback: string; remove: string }> = {
  ru: {
    description: "Робот Portfolio+: что он читает на сайтах и как его остановить.",
    intro:
      "Portfolio+ — учебный проект команды Team KAYA: каталог олимпиад, конкурсов, волонтёрских программ и университетов для школьников Казахстана. Чтобы каталог не устаревал, раз в день наш робот читает несколько сайтов организаторов и ищет новые возможности. Всё найденное сначала проверяет человек, и только потом оно появляется в каталоге со ссылкой на источник.",
    behaviour: "Как он себя ведёт",
    rules: [
      "представляется как «Portfolio+Bot» со ссылкой на эту страницу;",
      "соблюдает robots.txt — правила для «*» и для «Portfolio+Bot»;",
      "открывает только страницы мероприятий с выбранных сайтов, не больше 20 новых за раз и не чаще раза в секунду;",
      "одну и ту же страницу перечитывает не чаще раза в месяц;",
      "не заполняет формы, не входит в аккаунты и не собирает персональные данные.",
    ],
    stop: "Как его остановить",
    addRobots: "Добавьте в robots.txt вашего сайта:",
    write: "Или напишите нам: ",
    writeFallback: "Или напишите нам через руководителя проекта Portfolio+",
    remove: "Если ваш материал оказался в каталоге по ошибке, мы уберём его.",
  },
  kz: {
    description: "Portfolio+ роботы: сайттардан нені оқиды және оны қалай тоқтатуға болады.",
    intro:
      "Portfolio+ — Team KAYA командасының оқу жобасы: Қазақстан оқушыларына арналған олимпиадалар, байқаулар, волонтерлік бағдарламалар және университеттер каталогы. Каталог ескірмеуі үшін біздің робот күніне бір рет ұйымдастырушылардың бірнеше сайтын оқып, жаңа мүмкіндіктерді іздейді. Табылғанның бәрін алдымен адам тексереді, содан кейін ғана ол дереккөзге сілтемемен каталогта пайда болады.",
    behaviour: "Ол өзін қалай ұстайды",
    rules: [
      "өзін осы бетке сілтемесі бар «Portfolio+Bot» деп таныстырады;",
      "robots.txt ережелерін сақтайды — «*» және «Portfolio+Bot» үшін;",
      "таңдалған сайттардағы тек іс-шара беттерін ашады, бір реттен 20 жаңа беттен артық емес және секундына бір реттен жиі емес;",
      "бір бетті айына бір реттен жиі қайта оқымайды;",
      "формаларды толтырмайды, аккаунттарға кірмейді және жеке деректер жинамайды.",
    ],
    stop: "Оны қалай тоқтатуға болады",
    addRobots: "Сайтыңыздың robots.txt файлына қосыңыз:",
    write: "Немесе бізге жазыңыз: ",
    writeFallback: "Немесе бізге Portfolio+ жобасының жетекшісі арқылы жазыңыз",
    remove: "Егер сіздің материалыңыз каталогқа қателесіп түссе, біз оны алып тастаймыз.",
  },
  en: {
    description: "The Portfolio+ robot: what it reads on websites and how to stop it.",
    intro:
      "Portfolio+ is a school project by Team KAYA: a catalogue of olympiads, competitions, volunteer programmes and universities for school students in Kazakhstan. To keep the catalogue current, once a day our robot reads a few organisers' websites and looks for new opportunities. A person checks everything it finds first; only then does it appear in the catalogue, with a link to the source.",
    behaviour: "How it behaves",
    rules: [
      "it identifies itself as “Portfolio+Bot” with a link to this page;",
      "it follows robots.txt — the rules for “*” and for “Portfolio+Bot”;",
      "it opens only event pages of selected sites, no more than 20 new ones per run and no more than one request per second;",
      "it re-reads the same page at most once a month;",
      "it does not fill in forms, does not sign in to accounts and does not collect personal data.",
    ],
    stop: "How to stop it",
    addRobots: "Add this to your site's robots.txt:",
    write: "Or write to us: ",
    writeFallback: "Or contact us through the Portfolio+ project lead",
    remove: "If your material appeared in the catalogue by mistake, we will remove it.",
  },
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isEnabledLocale(locale)) return {}
  return { title: "Portfolio+Bot", description: COPY[locale].description, alternates: localeAlternates(locale, (l) => `/${l}/bot`) }
}

export default async function BotPage({ params }: Props) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()
  const copy = COPY[locale]

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-3xl min-w-0 space-y-6 break-words px-4 py-12 text-[15px] leading-relaxed text-gray-300 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Portfolio+Bot</h1>
        <p>{copy.intro}</p>
        <h2 className="text-xl font-semibold text-white">{copy.behaviour}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {copy.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <h2 className="text-xl font-semibold text-white">{copy.stop}</h2>
        <p>{copy.addRobots}</p>
        <pre className="overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#0d1210] p-4 text-sm text-emerald-200">
          {"User-agent: Portfolio+Bot\nDisallow: /"}
        </pre>
        <p>
          {CONTACT ? (
            <>
              {copy.write}
              <a href={`mailto:${CONTACT}`} className="text-emerald-300 underline underline-offset-2">
                {CONTACT}
              </a>
              .
            </>
          ) : (
            `${copy.writeFallback}.`
          )}{" "}
          {copy.remove}
        </p>
      </article>
    </SiteShell>
  )
}
