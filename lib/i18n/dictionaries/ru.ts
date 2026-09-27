import type { PluralForms } from "../format"

// Every string the interface shows. Filter vocabulary (subjects, cities, levels)
// stays in FILTER_CONFIGS in lib/types.ts, the single source the UI, the admin
// form and the AI tool share; translating it is part of Phase 7.
//
// Other locales must match this shape exactly (see Dictionary below).
export const ru = {
  meta: {
    siteName: "Portfolio+",
    title: "Portfolio+ — возможности для школьников Казахстана",
    description:
      "Олимпиады, соревнования, волонтёрство и университеты Казахстана в одном месте. Найди возможность и прокачай своё портфолио.",
  },
  header: {
    tagline: "Возможности для молодёжи",
    home: "Portfolio+ — на главную",
    skipToContent: "Перейти к содержимому",
  },
  hero: {
    badge: "Платформа для молодёжи Казахстана",
    titleLine1: "Найди свою",
    titleLine2: "возможность",
    subtitle:
      "Олимпиады, соревнования, волонтёрство и лучшие университеты Казахстана — всё в одном месте для построения твоего успешного будущего",
    cta: "Начать поиск",
  },
  categories: {
    olympiads: {
      label: "Олимпиады",
      title: "Олимпиады для школьников Казахстана",
      description: "Предметные олимпиады для школьников Казахстана: уровни, сроки регистрации и ссылки на организаторов.",
    },
    competitions: {
      label: "Соревнования",
      title: "Конкурсы и хакатоны для школьников Казахстана",
      description: "Научные, технические, творческие конкурсы и хакатоны для школьников и студентов Казахстана.",
    },
    volunteering: {
      label: "Волонтёрство",
      title: "Волонтёрство для молодёжи Казахстана",
      description: "Волонтёрские программы в городах Казахстана и онлайн: социальные, экологические, событийные.",
    },
    universities: {
      label: "Университеты",
      title: "Университеты Казахстана: гранты и поступление",
      description: "Университеты Казахстана: направления, гранты, требования ЕНТ и ссылки для поступления.",
    },
  },
  catalogue: {
    categoriesLabel: "Категории",
    quickFiltersLabel: "Быстрые фильтры",
    searchLabel: "Поиск по возможностям",
    searchPlaceholder: "Поиск: физика, Алматы, онлайн…",
    clearSearch: "Очистить поиск",
    filters: "Фильтры",
    filtersTitle: "Фильтры",
    filtersDescription: "Выберите параметры — результаты обновятся сразу.",
    resetAll: "Сбросить всё",
    showResults: "Показать результаты",
    removeFilter: "Убрать фильтр «{label}»",
    sortLabel: "Порядок",
    sortDeadline: "Сначала ближайший дедлайн",
    sortNewest: "Сначала новые",
    showPast: "Показывать завершённые",
    found: ["Найдена {n} возможность", "Найдено {n} возможности", "Найдено {n} возможностей"] as PluralForms,
    updating: "Обновляем…",
    empty: "В этой категории пока нет записей. Загляните позже!",
    emptyFiltered: "Ничего не найдено. Попробуйте изменить запрос или фильтры.",
    showPastInstead: "Показать завершённые",
    resetSearchAndFilters: "Сбросить поиск и фильтры",
    loadError: "Не удалось загрузить данные. Проверьте подключение к интернету.",
    retry: "Повторить",
  },
  pagination: {
    label: "Страницы каталога",
    previous: "Назад",
    next: "Дальше",
    status: "Страница {page} из {total}",
    outOfRange: "Такой страницы нет.",
    firstPage: "На первую страницу",
  },
  card: {
    grant: "Грант",
    noDeadline: "Без дедлайна",
    closed: "Завершено",
    lastDay: "Последний день",
    daysLeft: ["Остался {n} день", "Осталось {n} дня", "Осталось {n} дней"] as PluralForms,
  },
  details: {
    dialogDescription: "Подробности о возможности",
    deadline: "Дедлайн",
    noDeadline: "Без дедлайна",
    about: "Описание",
    noDescription: "Описание не указано.",
    parameters: "Параметры",
    source: "Источник",
    goToSite: "Перейти на сайт организатора",
    noLink: "Ссылка на источник не указана",
    share: "Поделиться",
    copied: "Ссылка скопирована",
    copyFailed: "Не получилось скопировать ссылку",
    openPage: "Отдельная страница",
    close: "Закрыть",
    backTo: "Все {category}",
    loading: "Загружаем…",
    notFound: "Эта возможность не найдена — возможно, её убрали из каталога.",
    grant: "Есть гранты",
  },
  notes: {
    open: "Заметки",
    title: "Рабочий стол заметок",
    subtitle: "Записывайте свои цели, достижения и планы",
    close: "Закрыть",
    create: "Создать заметку",
    newNote: "Новая заметка",
    cancel: "Отменить",
    titlePlaceholder: "Название заметки",
    contentPlaceholder: "Напишите о своих целях, портфолио, кем хотите стать...",
    save: "Сохранить заметку",
    untitled: "Без названия",
    emptyTitle: "У вас пока нет заметок",
    emptyText: "Создайте первую заметку о своих целях",
    edit: "Редактировать «{title}»",
    editHint: "Нажмите, чтобы редактировать...",
    done: "Готово",
    delete: "Удалить заметку «{title}»",
    categoryLabel: "Тип заметки",
    categories: {
      goals: "Цели",
      portfolio: "Портфолио",
      ideas: "Идеи",
      other: "Другое",
    },
    storedLocally: "Заметки хранятся только на этом устройстве",
  },
  ai: {
    open: "ИИ Помощник",
    title: "ИИ Помощник",
    close: "Закрыть",
    clear: "Очистить",
    signOut: "Выйти",
    notesUsed: ["Анализирую {n} заметку для персональных советов", "Анализирую {n} заметки для персональных советов", "Анализирую {n} заметок для персональных советов"] as PluralForms,
    noNotes: "Создайте заметки, чтобы я давал персональные советы",
    signInTitle: "Войдите, чтобы пользоваться ИИ-помощником",
    signInText: "Это бесплатно. Вход защищает помощника от ботов — так он остаётся бесплатным для школьников.",
    greeting: "Привет! Я ваш персональный ИИ-помощник",
    greetingText: "Подбираю возможности из каталога и даю советы по вашим заметкам",
    suggestions: ["Подбери олимпиаду по физике", "Какие хакатоны скоро?", "Оцени моё портфолио"],
    thinking: "Думаю...",
    inputPlaceholder: "Спросите о возможностях, целях, портфолио...",
    inputLabel: "Сообщение ИИ-помощнику",
    send: "Отправить",
    contextNotes: ["{n} заметка используется для контекста", "{n} заметки используются для контекста", "{n} заметок используется для контекста"] as PluralForms,
    contextNone: "Добавьте заметки для персональных рекомендаций",
    quotaLeft: ["Сегодня осталось {n} сообщение из {limit}", "Сегодня осталось {n} сообщения из {limit}", "Сегодня осталось {n} сообщений из {limit}"] as PluralForms,
    quotaExhausted: "Лимит на сегодня исчерпан — возвращайтесь завтра",
    sessionExpired: "Сессия истекла. Войдите снова.",
    failed: "Не удалось получить ответ. Попробуйте ещё раз.",
  },
  auth: {
    emailLabel: "Email",
    getCode: "Получить код на почту",
    sentTo: "Мы отправили письмо на {email}. Введите код из письма или просто перейдите по ссылке в нём.",
    codePlaceholder: "Код из письма",
    signIn: "Войти",
    changeEmail: "Изменить email",
    resend: "Отправить снова",
    resendIn: "Отправить снова через {s} с",
    or: "или",
    google: "Войти через Google",
    errors: {
      rateLimit: "Слишком много попыток. Подождите минуту и попробуйте снова.",
      invalidCode: "Код неверный или устарел. Запросите новый.",
      signupsClosed: "Регистрация временно закрыта.",
      generic: "Не получилось войти. Попробуйте ещё раз.",
    },
  },
  footer: {
    rights: "© {year} Portfolio+",
    tagline: "Платформа возможностей для молодёжи Казахстана",
  },
  notFound: {
    title: "Страница не найдена",
    text: "Такой страницы нет. Возможно, ссылка устарела или в адресе опечатка.",
    home: "Перейти в каталог",
  },
  error: {
    title: "Что-то пошло не так",
    text: "Мы уже знаем об ошибке. Попробуйте обновить страницу.",
    retry: "Попробовать снова",
    home: "На главную",
  },
}

type Widen<T> = T extends string
  ? string
  : T extends readonly [string, string, string]
    ? PluralForms
    : T extends readonly string[]
      ? readonly string[]
      : { [K in keyof T]: Widen<T[K]> }

export type Dictionary = Widen<typeof ru>
