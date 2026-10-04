// The error-page copy on its own, for app/global-error.tsx: that boundary is
// part of every page's JavaScript and has no i18n provider, and importing the
// whole dictionary there put every interface string into the bundle twice.
export const ruError = {
  title: "Что-то пошло не так",
  text: "Мы уже знаем об ошибке. Попробуйте обновить страницу.",
  retry: "Попробовать снова",
  home: "На главную",
}
