export type Category = "olympiads" | "competitions" | "volunteering" | "universities"

export const CATEGORIES: Category[] = ["olympiads", "competitions", "volunteering", "universities"]

export type OpportunityStatus = "pending" | "published" | "rejected" | "archived"

// A row of public.opportunities.
export interface Opportunity {
  id: string
  kind: Category
  status: OpportunityStatus
  slug: string
  title: string
  description: string
  link: string | null
  // Calendar date "YYYY-MM-DD", Almaty time; see lib/deadline.ts.
  deadline: string | null
  created_at: string
  updated_at: string
  image_url?: string | null
  // Filter fields
  subject?: string | null
  level?: string | null
  type?: string | null
  age_group?: string | null
  format?: string | null
  duration?: string | null
  city?: string | null
  field?: string | null
  requirements?: string | null
  grant_available?: boolean | null
  // Universities: last year's lowest ENT score that won a grant, and that year.
  pass_score?: number | null
  pass_score_year?: number | null
  // Found by the nightly search (Phase 6): the page it came from, and when a person checked it.
  source_url?: string | null
  reviewed_at?: string | null
  // Kazakh and English text, when the row has it (lib/catalogue.ts localizes).
  title_kk?: string | null
  title_en?: string | null
  description_kk?: string | null
  description_en?: string | null
}

// Active filters: filter key -> selected values.
export type Filters = Record<string, string[]>

export interface FilterOption {
  label: string
  value: string
}

export interface FilterConfig {
  key: keyof Opportunity
  label: string
  options: FilterOption[]
  icon?: string
}

// Города Казахстана
export const KAZAKHSTAN_CITIES: FilterOption[] = [
  { label: 'Алматы', value: 'almaty' },
  { label: 'Астана', value: 'astana' },
  { label: 'Шымкент', value: 'shymkent' },
  { label: 'Караганда', value: 'karaganda' },
  { label: 'Актобе', value: 'aktobe' },
  { label: 'Тараз', value: 'taraz' },
  { label: 'Павлодар', value: 'pavlodar' },
  { label: 'Усть-Каменогорск', value: 'ust-kamenogorsk' },
  { label: 'Семей', value: 'semey' },
  { label: 'Атырау', value: 'atyrau' },
  { label: 'Костанай', value: 'kostanay' },
  { label: 'Кызылорда', value: 'kyzylorda' },
  { label: 'Уральск', value: 'uralsk' },
  { label: 'Петропавловск', value: 'petropavlovsk' },
  { label: 'Актау', value: 'aktau' },
  { label: 'Туркестан', value: 'turkestan' },
  { label: 'Онлайн (вся РК)', value: 'online' },
]

export const FILTER_CONFIGS: Record<Category, FilterConfig[]> = {
  olympiads: [
    { key: 'subject', label: 'Предмет', icon: 'book', options: [
      { label: 'Математика', value: 'math' },
      { label: 'Физика', value: 'physics' },
      { label: 'Информатика', value: 'informatics' },
      { label: 'Химия', value: 'chemistry' },
      { label: 'Биология', value: 'biology' },
      { label: 'История Казахстана', value: 'history-kz' },
      { label: 'Казахский язык', value: 'kazakh' },
      { label: 'Русский язык', value: 'russian' },
      { label: 'Английский язык', value: 'english' },
      { label: 'География', value: 'geography' },
    ]},
    { key: 'level', label: 'Уровень', icon: 'trophy', options: [
      { label: 'Школьный', value: 'school' },
      { label: 'Районный', value: 'district' },
      { label: 'Областной', value: 'regional' },
      { label: 'Республиканский', value: 'national' },
      { label: 'Международный', value: 'international' },
    ]},
    { key: 'age_group', label: 'Класс', icon: 'users', options: [
      { label: '5-7 класс', value: '5-7' },
      { label: '8-9 класс', value: '8-9' },
      { label: '10-11 класс', value: '10-11' },
      { label: 'Студенты', value: 'students' },
    ]},
    { key: 'format', label: 'Формат', icon: 'monitor', options: [
      { label: 'Онлайн', value: 'online' },
      { label: 'Офлайн', value: 'offline' },
      { label: 'Гибридный', value: 'hybrid' },
    ]},
    { key: 'city', label: 'Город', icon: 'map-pin', options: KAZAKHSTAN_CITIES },
  ],
  competitions: [
    { key: 'type', label: 'Тип', icon: 'zap', options: [
      { label: 'Спортивные', value: 'sports' },
      { label: 'Творческие', value: 'creative' },
      { label: 'Научные', value: 'scientific' },
      { label: 'Технические', value: 'technical' },
      { label: 'Робототехника', value: 'robotics' },
      { label: 'Бизнес/Стартапы', value: 'business' },
      { label: 'Хакатоны', value: 'hackathon' },
    ]},
    { key: 'level', label: 'Уровень', icon: 'trophy', options: [
      { label: 'Городской', value: 'city' },
      { label: 'Областной', value: 'regional' },
      { label: 'Республиканский', value: 'national' },
      { label: 'Международный', value: 'international' },
    ]},
    { key: 'age_group', label: 'Возраст', icon: 'users', options: [
      { label: 'До 14 лет', value: 'under-14' },
      { label: '14-18 лет', value: '14-18' },
      { label: '18-25 лет', value: '18-25' },
      { label: 'Без ограничений', value: 'any' },
    ]},
    { key: 'format', label: 'Формат', icon: 'monitor', options: [
      { label: 'Онлайн', value: 'online' },
      { label: 'Офлайн', value: 'offline' },
      { label: 'Гибридный', value: 'hybrid' },
    ]},
    { key: 'city', label: 'Город', icon: 'map-pin', options: KAZAKHSTAN_CITIES },
  ],
  volunteering: [
    { key: 'type', label: 'Направление', icon: 'heart', options: [
      { label: 'Социальное', value: 'social' },
      { label: 'Экологическое', value: 'ecological' },
      { label: 'Событийное', value: 'events' },
      { label: 'Медицинское', value: 'medical' },
      { label: 'Образовательное', value: 'educational' },
      { label: 'Спортивное', value: 'sports' },
      { label: 'Культурное', value: 'cultural' },
    ]},
    { key: 'duration', label: 'Длительность', icon: 'clock', options: [
      { label: 'Разовое (1 день)', value: 'one-time' },
      { label: 'Краткосрочное (до месяца)', value: 'short' },
      { label: 'Долгосрочное (более месяца)', value: 'long' },
      { label: 'Постоянное', value: 'permanent' },
    ]},
    { key: 'format', label: 'Формат', icon: 'monitor', options: [
      { label: 'Онлайн', value: 'online' },
      { label: 'Офлайн', value: 'offline' },
      { label: 'Гибридный', value: 'hybrid' },
    ]},
    { key: 'age_group', label: 'Возраст', icon: 'users', options: [
      { label: 'От 14 лет', value: '14+' },
      { label: 'От 16 лет', value: '16+' },
      { label: 'От 18 лет', value: '18+' },
      { label: 'Любой возраст', value: 'any' },
    ]},
    { key: 'city', label: 'Город', icon: 'map-pin', options: KAZAKHSTAN_CITIES },
  ],
  universities: [
    { key: 'city', label: 'Город', icon: 'map-pin', options: KAZAKHSTAN_CITIES },
    { key: 'field', label: 'Направление', icon: 'graduation-cap', options: [
      { label: 'IT и Программирование', value: 'it' },
      { label: 'Инженерия', value: 'engineering' },
      { label: 'Медицина', value: 'medical' },
      { label: 'Экономика и Бизнес', value: 'economics' },
      { label: 'Юриспруденция', value: 'law' },
      { label: 'Педагогика', value: 'pedagogy' },
      { label: 'Гуманитарные науки', value: 'humanities' },
      { label: 'Естественные науки', value: 'natural-sciences' },
      { label: 'Творческие', value: 'creative' },
    ]},
    { key: 'type', label: 'Тип ВУЗа', icon: 'building', options: [
      { label: 'Государственный', value: 'state' },
      { label: 'Частный', value: 'private' },
      { label: 'Международный', value: 'international' },
    ]},
    { key: 'grant_available', label: 'Грант', icon: 'wallet', options: [
      { label: 'Есть гранты', value: 'true' },
      { label: 'Только платное', value: 'false' },
    ]},
    { key: 'format', label: 'Формат обучения', icon: 'monitor', options: [
      { label: 'Очное', value: 'offline' },
      { label: 'Заочное', value: 'part-time' },
      { label: 'Дистанционное', value: 'online' },
    ]},
    { key: 'requirements', label: 'Требования', icon: 'clipboard', options: [
      { label: 'ЕНТ от 50', value: 'ent-50' },
      { label: 'ЕНТ от 70', value: 'ent-70' },
      { label: 'ЕНТ от 90', value: 'ent-90' },
      { label: 'Без ЕНТ', value: 'no-ent' },
      { label: 'Собеседование', value: 'interview' },
    ]},
  ],
}

export const CATEGORY_LABELS: Record<Category, string> = {
  olympiads: 'Олимпиады',
  competitions: 'Соревнования',
  volunteering: 'Волонтёрство',
  universities: 'Университеты',
}

export function getFilterLabel(category: Category, key: string, value: string): string {
  const config = FILTER_CONFIGS[category].find((c) => c.key === key)
  const option = config?.options.find((o) => o.value === value)
  return option?.label || value
}

export interface QuickFilter {
  key: string
  value: string
}

// One-tap chips under the category tabs. Every value comes from FILTER_CONFIGS,
// so a chip and the matching checkbox in the filter dialog are the same filter.
export const QUICK_FILTERS: Record<Category, QuickFilter[]> = {
  olympiads: [
    { key: "subject", value: "math" },
    { key: "subject", value: "physics" },
    { key: "subject", value: "informatics" },
    { key: "subject", value: "chemistry" },
    { key: "subject", value: "biology" },
  ],
  competitions: [
    { key: "type", value: "hackathon" },
    { key: "type", value: "robotics" },
    { key: "type", value: "scientific" },
    { key: "type", value: "business" },
  ],
  volunteering: [
    { key: "type", value: "social" },
    { key: "type", value: "ecological" },
    { key: "type", value: "educational" },
    { key: "format", value: "online" },
  ],
  universities: [
    { key: "grant_available", value: "true" },
    { key: "field", value: "it" },
    { key: "field", value: "medical" },
    { key: "field", value: "engineering" },
  ],
}
