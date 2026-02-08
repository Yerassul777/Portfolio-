// Database tables
export type Category = "olympiads" | "competitions" | "volunteering" | "universities"

export interface BaseOpportunity {
  id: string
  title: string
  description: string
  link: string
  created_at: string
  image_url?: string | null
}

export interface Olympiad extends BaseOpportunity {
  subject?: string | null
  level?: string | null
  deadline?: string | null
  format?: string | null
  city?: string | null
  grant_available?: boolean | null
}

export interface Competition extends BaseOpportunity {
  type?: string | null
  prize_fund?: string | null
  deadline?: string | null
  format?: string | null
  city?: string | null
  grant_available?: boolean | null
}

export interface Volunteering extends BaseOpportunity {
  organization?: string | null
  duration?: string | null
  format?: string | null
  city?: string | null
  cause?: string | null
}

export interface University extends BaseOpportunity {
  city?: string | null
  ranking?: string | null
  tuition_type?: string | null
  grant_available?: boolean | null
  programs?: string | null
}

export type Opportunity = Olympiad | Competition | Volunteering | University

// Filter configurations
export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: keyof Opportunity
  label: string
  icon?: string
  options: FilterOption[]
}

export const KAZAKHSTAN_CITIES = [
  { value: "almaty", label: "Алматы" },
  { value: "astana", label: "Астана" },
  { value: "shymkent", label: "Шымкент" },
  { value: "aktobe", label: "Актобе" },
  { value: "karaganda", label: "Караганда" },
  { value: "taraz", label: "Тараз" },
  { value: "pavlodar", label: "Павлодар" },
  { value: "ust-kamenogorsk", label: "Усть-Каменогорск" },
  { value: "semey", label: "Семей" },
  { value: "aktau", label: "Актау" },
  { value: "kostanay", label: "Костанай" },
  { value: "kyzylorda", label: "Кызылорда" },
  { value: "atyrau", label: "Атырау" },
  { value: "petropavlovsk", label: "Петропавловск" },
  { value: "oral", label: "Уральск" },
] as const

export const FILTER_CONFIGS: Record<Category, FilterConfig[]> = {
  olympiads: [
    {
      key: "subject",
      label: "Предмет",
      icon: "book",
      options: [
        { value: "math", label: "Математика" },
        { value: "physics", label: "Физика" },
        { value: "chemistry", label: "Химия" },
        { value: "biology", label: "Биология" },
        { value: "informatics", label: "Информатика" },
        { value: "kazakh", label: "Казахский язык" },
        { value: "russian", label: "Русский язык" },
        { value: "english", label: "Английский язык" },
        { value: "history", label: "История" },
        { value: "geography", label: "География" },
      ],
    },
    {
      key: "level",
      label: "Уровень",
      icon: "trophy",
      options: [
        { value: "school", label: "Школьный" },
        { value: "regional", label: "Региональный" },
        { value: "national", label: "Республиканский" },
        { value: "international", label: "Международный" },
      ],
    },
    {
      key: "format",
      label: "Формат",
      icon: "monitor",
      options: [
        { value: "online", label: "Онлайн" },
        { value: "offline", label: "Офлайн" },
        { value: "hybrid", label: "Гибридный" },
      ],
    },
    {
      key: "city",
      label: "Город",
      icon: "map-pin",
      options: KAZAKHSTAN_CITIES,
    },
    {
      key: "grant_available",
      label: "Грант",
      icon: "wallet",
      options: [
        { value: "true", label: "Есть грант" },
        { value: "false", label: "Без гранта" },
      ],
    },
  ],
  competitions: [
    {
      key: "type",
      label: "Тип",
      icon: "zap",
      options: [
        { value: "hackathon", label: "Хакатон" },
        { value: "case-competition", label: "Кейс-чемпионат" },
        { value: "startup", label: "Стартап" },
        { value: "creative", label: "Творческий" },
        { value: "sports", label: "Спортивный" },
        { value: "science", label: "Научный" },
      ],
    },
    {
      key: "format",
      label: "Формат",
      icon: "monitor",
      options: [
        { value: "online", label: "Онлайн" },
        { value: "offline", label: "Офлайн" },
        { value: "hybrid", label: "Гибридный" },
      ],
    },
    {
      key: "city",
      label: "Город",
      icon: "map-pin",
      options: KAZAKHSTAN_CITIES,
    },
    {
      key: "grant_available",
      label: "Призовой фонд",
      icon: "wallet",
      options: [
        { value: "true", label: "Есть призовой фонд" },
        { value: "false", label: "Без призового фонда" },
      ],
    },
  ],
  volunteering: [
    {
      key: "cause",
      label: "Направление",
      icon: "heart",
      options: [
        { value: "education", label: "Образование" },
        { value: "environment", label: "Экология" },
        { value: "social", label: "Социальное" },
        { value: "health", label: "Здравоохранение" },
        { value: "culture", label: "Культура" },
        { value: "animals", label: "Животные" },
      ],
    },
    {
      key: "duration",
      label: "Длительность",
      icon: "clock",
      options: [
        { value: "short", label: "До 1 месяца" },
        { value: "medium", label: "1-3 месяца" },
        { value: "long", label: "3+ месяцев" },
      ],
    },
    {
      key: "format",
      label: "Формат",
      icon: "monitor",
      options: [
        { value: "online", label: "Онлайн" },
        { value: "offline", label: "Офлайн" },
        { value: "hybrid", label: "Гибридный" },
      ],
    },
    {
      key: "city",
      label: "Город",
      icon: "map-pin",
      options: KAZAKHSTAN_CITIES,
    },
  ],
  universities: [
    {
      key: "city",
      label: "Город",
      icon: "map-pin",
      options: KAZAKHSTAN_CITIES,
    },
    {
      key: "ranking",
      label: "Рейтинг",
      icon: "graduation-cap",
      options: [
        { value: "top10", label: "Топ-10" },
        { value: "top20", label: "Топ-20" },
        { value: "top50", label: "Топ-50" },
      ],
    },
    {
      key: "tuition_type",
      label: "Форма обучения",
      icon: "clipboard",
      options: [
        { value: "full-time", label: "Очное" },
        { value: "part-time", label: "Заочное" },
        { value: "online", label: "Онлайн" },
      ],
    },
    {
      key: "grant_available",
      label: "Грант",
      icon: "wallet",
      options: [
        { value: "true", label: "Есть гранты" },
        { value: "false", label: "Без грантов" },
      ],
    },
  ],
}
