# Резервные копии базы

На бесплатном тарифе Supabase сам не делает резервных копий. Поэтому каждую ночь GitHub Actions выгружает базу (`.github/workflows/db-backup.yml`), шифрует выгрузку и хранит её 30 дней как артефакт сборки.

Репозиторий публичный, и артефакты может скачать кто угодно. Поэтому выгрузка шифруется ключом [age](https://github.com/FiloSottile/age). Открыть её может только тот, у кого есть приватный ключ.

## Как включить (один раз)

1. **Создайте ключ на своём компьютере:**
   ```bash
   age-keygen -o portfolio-backup.key
   ```
   - Строка `# public key: age1...` — публичный ключ.
   - Файл `portfolio-backup.key` — приватный. Храните его вне GitHub, например на флешке и в менеджере паролей, у двух человек из команды. Без него резервную копию не открыть.
2. **Добавьте переменную в GitHub** (Settings → Secrets and variables → Actions → Variables): `BACKUP_AGE_RECIPIENT` = публичный ключ `age1...`.
3. **Возьмите строку подключения в Supabase** (Project Settings → Database → Connection string → Session pooler) и добавьте её в GitHub как секрет (Secrets): `SUPABASE_DB_URL`. Session pooler нужен потому, что у серверов GitHub нет IPv6.
4. **Запустите workflow вручную:** Actions → Database backup → Run workflow. Проверьте, что появился артефакт `db-backup-…`.

Пока секрет и переменная не заданы, workflow ничего не делает и не падает.

## Как восстановить (и проверять раз в месяц)

1. Скачайте артефакт и расшифруйте его:
   ```bash
   age -d -i portfolio-backup.key backup-ГГГГ-ММ-ДД.tar.gz.age | tar xzf -
   ```
2. Поднимите пустую базу: второй бесплатный проект Supabase или `supabase start` локально.
3. Загрузите файлы по порядку:
   ```bash
   psql "<строка подключения>" -f roles.sql -f schema.sql -f data.sql
   ```
4. Сравните число строк в `opportunities`, `profiles` и `notes` с рабочей базой и войдите тестовым пользователем.

Запишите, сколько это заняло времени и что пошло не так.

**Перед каждой миграцией** запускайте бэкап вручную.

## Что ещё защищает данные

- **Записи каталога не удаляются через сайт.** Кнопка в админке переводит запись в архив, и её можно вернуть.
- **Каждое изменение каталога пишется в `private.audit_log`** вместе с прежней версией строки. Восстановить запись из журнала:
  ```sql
  insert into public.opportunities
  select * from jsonb_populate_record(null::public.opportunities, (select old_row from private.audit_log where id = <номер>));
  ```
- **Изменить больше 5 записей одним запросом через API нельзя.** Массовые правки делаются только в SQL-редакторе Supabase.
