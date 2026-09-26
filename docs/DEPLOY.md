# Put EventControl online (free): Render + Supabase

You end up with a permanent link like `https://eventcontrol-xxxx.onrender.com` that anyone can
open, from any device, whether or not your laptop is on. Takes about 20 minutes, once.
No credit card needed.

- **Supabase** keeps the events (database) and the uploaded files (storage).
- **Render** runs the website from this GitHub repository and gives you the link.

---

## Part A — Supabase

1. Go to **https://supabase.com** → *Start your project* → sign in with **GitHub**.
2. **New project**
   - Name: `eventcontrol`
   - Database password: **letters and numbers only** (no `@ # / ? :`). **Write it down.**
   - Region: the one nearest to you (e.g. *South Asia (Mumbai)* or *Southeast Asia (Singapore)*).
   - *Create new project*, wait ~2 minutes.
3. **Storage → New bucket** → name `eventcontrol` → **Public bucket: off** → *Create*.
4. **Connect** (button at the top) → choose **Session pooler** → copy the address:
   `postgresql://postgres.abcd…:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
   Replace `[YOUR-PASSWORD]` **including the brackets** with your password from step 2.
   → this is your **DATABASE_URL**. (Not the "Direct connection" — Render can't reach that one.)
5. **Project Settings** (gear) → **Data API** → copy the **Project URL** (`https://abcd.supabase.co`)
   → this is your **SUPABASE_URL**.
6. **Project Settings → API Keys** → copy the **service_role** key (tab *Legacy API Keys*, click
   *Reveal*) — or, if you only see new keys, a **Secret key** (`sb_secret_…`). Both work.
   → this is your **SUPABASE_SERVICE_ROLE_KEY**. Keep it secret; it only ever goes into Render.

## Part B — Render

1. Go to **https://render.com** → *Get started* → sign up with **GitHub**. When GitHub asks which
   repositories Render may see, allow **event-projector-controller**.
2. **New +** → **Blueprint** → pick **event-projector-controller** (branch `main`).
   Render reads `render.yaml` and proposes a free web service called **eventcontrol**.
3. Fill in the three values from Part A:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | Session pooler address, with your password in it |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role (or secret) key |

   Leave `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` empty (Google Drive is optional, later).
4. **Apply**. The first build takes **~10 minutes** (it installs LibreOffice for PowerPoint files).
5. When the log shows **`EventControl is running`**, your link is at the top of the page:
   **`https://eventcontrol-xxxx.onrender.com`** — open it, and share it.

The site starts with a demo event; create your own events and upload your files there
(your laptop's events are not copied over).

---

## Using it

- **Share the link** with your crew. No password: anyone with the link can run the show, so
  don't post it publicly. (Want a password? In Render → *Environment*, set `AUTH_PROVIDER=local`.)
- **Projector:** on the projector computer, open the link → the event → **Open display** (or
  *Settings → Event & sharing → Projector link*). Press **F** in it for fullscreen.
- **Free plan sleeps** after ~15 minutes without visitors; the first visit then takes about a
  minute. **Open the link 5 minutes before the event.**
- **Supabase pauses** a free project after a week without use — *Restore* it in Supabase
  (nothing is lost).
- **Updates:** every push to GitHub `main` redeploys automatically.

## If something goes wrong

Open your service in Render → **Logs**. EventControl says what is wrong in plain words:

| Log says | Fix |
| --- | --- |
| `DATABASE_URL still contains [YOUR-PASSWORD]` | Render → *Environment* → edit `DATABASE_URL`, put your password in place of `[YOUR-PASSWORD]` (brackets too). |
| `DATABASE_URL is Supabase's "Direct connection"` | Use the **Session pooler** address instead (it contains `pooler.supabase.com`). |
| `DATABASE_URL is not a valid address` / `password authentication failed` | Reset the database password in Supabase (*Project Settings → Database*) to letters and numbers only, and update `DATABASE_URL`. |
| `Supabase upload failed (400/403)` | Check `SUPABASE_URL` and the key, and that the bucket is called `eventcontrol`. |
| Page shows *Service unavailable* for a minute | The free instance is waking up — wait and refresh. |

After changing an environment variable, Render restarts the service by itself.
