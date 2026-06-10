# praxisAI v2 — Real DB · Invitations · Multi-Tenant

פלטפורמת AI קלינית לקליניקות פיזיותרפיה. גרסה זו מחליפה את `praxisai-next.zip`:
תפריט מימין (RTL), חיבור אמיתי ל-Supabase, כניסה בהזמנה בלבד, ניהול משתמשים ומעבר בין קליניקות.

## התקנה — 15 דקות

### 1. Supabase
1. צרו פרויקט ב-[supabase.com](https://supabase.com) (אזור: Frankfurt).
2. **SQL Editor** → הריצו את `sql/02_auth_and_data.sql` (טבלאות, RLS, טריגר הזמנות).
3. **Authentication → Providers → Email**: כבו **"Allow new users to sign up"** ← זה מה שחוסם הרשמה חופשית. כניסה רק דרך הזמנות.
4. **Authentication → Users → Add user**: צרו את עצמכם (מייל + סיסמה, Auto-confirm).
5. ערכו את המייל ב-`sql/03_bootstrap.sql` והריצו — נוצרת הקליניקה הראשונה ואתם owner.

### 2. אפליקציה
```bash
cp .env.example .env.local   # מלאו URL + anon key + service role (Settings → API)
npm install
npm run dev
```

### 3. מיילים מעוצבים (Resend)
1. חשבון ב-[resend.com](https://resend.com) → אימות דומיין → API key.
2. מלאו `RESEND_API_KEY` ו-`RESEND_FROM` ב-env.
3. **בלי Resend המערכת עדיין עובדת**: ההזמנה נוצרת והמסך מציג קישור להעתקה ידנית.

### 4. Vercel
פרסמו את הריפו ל-Vercel, הוסיפו את כל משתני ה-env, ועדכנו `NEXT_PUBLIC_APP_URL` לדומיין הסופי.
ב-Supabase → Authentication → URL Configuration הוסיפו את הדומיין ל-Redirect URLs (`https://your-app.vercel.app/**`).

## סשן והתחברות
מדיניות קשיחה: **8 שעות מרגע ההתחברות**, ללא חידוש הזחה. ה-middleware חותם את זמן
ההתחברות ומנתק אוטומטית אחרי 8 שעות (עם הודעה במסך הכניסה). חותמת הזמן נשמרת
ב-session cookie, כך שסגירת הדפדפן מסיימת אותה גם כן. שינוי המשך: `MAX_SESSION_MS`
ב-`src/middleware.ts` ו-`SESSION_MAX_AGE` ב-`src/lib/supabase/client.ts`.

## זרימת הזמנה
1. אדמין → "משתמשים והרשאות" → "הזמנת משתמש" (מייל + תפקיד).
2. נשלח מייל ממותג (RTL, צבעי המוצר) עם כפתור "הצטרפות לקליניקה".
3. לחיצה → Supabase מאמת → `/welcome` → המשתמש קובע שם וסיסמה.
4. טריגר DB מצרף אותו אוטומטית לקליניקה בתפקיד שהוגדר.
5. הזמנת מייל שכבר קיים במערכת → צירוף מיידי לקליניקה הנוספת + magic link.

## הרשאות
| תפקיד | יכולות |
|---|---|
| owner | הכל, כולל מינוי אדמינים |
| admin | ניהול משתמשים והזמנות, כל הנתונים הקליניים |
| therapist / receptionist | מטופלים, טיפולים ומסמכים בקליניקה שלהם |

RLS אוכף הכל ברמת ה-DB — אין שאילתה שעוקפת את בידוד הקליניקות.

## Multi-tenant switching
משתמש החבר ביותר מקליניקה אחת מקבל בורר קליניקות בראש הסיידבר.
המעבר מאומת בשרת (`/api/clinic`) ונשמר ב-cookie — כל המסכים מסתננים לפי הקליניקה הפעילה.

## אנליטיקות
לשונית "אנליטיקות" בסיידבר: KPI (טיפולים, מגמת VAS, מטופלים, מסמכים) וארבעה גרפים —
טיפולים שבועיים, מגמת VAS, התפלגות סוגי טיפול, ומטופלים לפי קופה.
**סינון לפי מטופל** מחליף את התצוגה לרמת מטופל: VAS לפי טיפול וגרף ROM למפרק הנמדד ביותר.

## מה הלאה
המודולים Scribe ו-Chat מסומנים "בקרוב" בסיידבר — הפורט שלהם מה-HTML prototype לתוך
המבנה הזה (עם שמירת תמלולים ו-SOAP ל-`treatments`) הוא הצעד הבא.
