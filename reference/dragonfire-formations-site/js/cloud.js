/*
 * cloud.js — OPTIONAL Google sign-in + cloud roster sync via Supabase.
 *
 * The app works fully offline (localStorage) without this. When js/config.js
 * has real Supabase keys AND Google is enabled as a provider in Supabase, a
 * "Sign in" button appears. Signing in loads the user's roster from the cloud
 * and keeps it synced, so it follows them across devices/browsers.
 *
 * One-time backend setup is documented at the bottom of this file.
 */
(function () {
  const cfg = window.DF_CONFIG || {};
  const btn = document.getElementById("btn-account");
  if (!btn) return;

  const configured =
    !!cfg.SUPABASE_URL &&
    !!cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR_") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR_") === -1;

  // Not set up yet (or SDK missing) → hide the button, stay offline-only.
  if (!configured) {
    btn.style.display = "none";
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    btn.style.display = "none";
    console.warn("[cloud] Supabase SDK not loaded — check the CDN <script> tag in index.html.");
    return;
  }

  // Configured + SDK present → reveal the sign-in button.
  btn.style.display = "";

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const TABLE = "rosters";
  let currentUser = null;

  function isSignedIn() { return !!currentUser; }

  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 2400);
  }

  // A "state" is the full roster collection: { version, activeId, rosters:[...] }.
  // (Legacy cloud rows may still hold a bare dragon array — handled on load.)
  function isEmptyState(s) {
    if (!s) return true;
    if (Array.isArray(s)) return s.length === 0;
    if (Array.isArray(s.rosters)) return s.rosters.every((r) => !r.dragons || r.dragons.length === 0);
    return true;
  }

  async function saveState(state) {
    if (!currentUser) return;
    try {
      const { error } = await client.from(TABLE).upsert(
        { user_id: currentUser.id, data: state, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    } catch (e) {
      console.error("[cloud] save failed", e);
      toast("Cloud save failed");
    }
  }

  async function loadState() {
    if (!currentUser) return null;
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("data")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (error) throw error;
      return data ? data.data : null;
    } catch (e) {
      console.error("[cloud] load failed", e);
      return null;
    }
  }

  async function onSignedIn(user) {
    // onAuthStateChange can fire repeatedly for the same user — only act once.
    if (currentUser && currentUser.id === user.id) { renderButton(); return; }
    currentUser = user;
    renderButton();

    const cloudState = await loadState();
    const local = window.APP && window.APP.getState();
    if (!isEmptyState(cloudState)) {
      window.APP.enterCloud(cloudState);
      toast("Rosters loaded from your account");
    } else if (!isEmptyState(local)) {
      // First sign-in with existing local rosters → seed the cloud with them,
      // then continue in cloud mode showing that same data.
      await saveState(local);
      window.APP.enterCloud(local);
      toast("Saved your rosters to your account");
    } else {
      window.APP.enterCloud(local || []);
    }
  }

  function onSignedOut() {
    const wasSignedIn = !!currentUser;
    currentUser = null;
    renderButton();
    // Clear the previous user's rosters from view and restore the guest workspace.
    if (wasSignedIn && window.APP && window.APP.exitCloud) window.APP.exitCloud();
  }

  function renderButton() {
    if (currentUser) {
      btn.textContent = "Sign out";
      btn.title = "Signed in as " + (currentUser.email || "account") + " — click to sign out";
    } else {
      btn.textContent = "Sign in";
      btn.title = "Sign in with Google to sync your roster across devices";
    }
  }

  function signInWithGoogle() {
    return client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname },
    });
  }

  function signOut() { return client.auth.signOut(); }

  btn.addEventListener("click", () => {
    if (currentUser) signOut(); else signInWithGoogle();
  });

  renderButton();

  // Fires on load (INITIAL_SESSION), after the Google redirect (SIGNED_IN),
  // and on sign-out — the single source of truth for auth state.
  client.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) onSignedIn(session.user);
    else onSignedOut();
  });

  window.CLOUD = { isSignedIn, saveState, loadState, signInWithGoogle, signOut };
})();

/* ───────────────────────── ONE-TIME BACKEND SETUP ─────────────────────────
 *
 * 1) Create a free project at https://supabase.com → copy the Project URL and
 *    the "anon public" key (Project Settings → API) into js/config.js.
 *
 * 2) Create the table + row-level security. In Supabase → SQL Editor, run:
 *
 *      create table if not exists public.rosters (
 *        user_id    uuid primary key references auth.users (id) on delete cascade,
 *        data       jsonb not null default '[]'::jsonb,
 *        updated_at timestamptz not null default now()
 *      );
 *
 *      alter table public.rosters enable row level security;
 *
 *      create policy "own roster - select" on public.rosters
 *        for select using (auth.uid() = user_id);
 *      create policy "own roster - insert" on public.rosters
 *        for insert with check (auth.uid() = user_id);
 *      create policy "own roster - update" on public.rosters
 *        for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 *    (RLS ensures each user can only read/write their OWN roster row.)
 *
 * 3) Enable Google login: Supabase → Authentication → Providers → Google → on.
 *    You'll need a Google OAuth client (Google Cloud Console → APIs & Services →
 *    Credentials → OAuth client ID → Web application). Paste the Client ID +
 *    Secret into Supabase, and add Supabase's callback URL (shown on that page,
 *    like https://<project>.supabase.co/auth/v1/callback) to the Google client's
 *    "Authorized redirect URIs".
 *
 * 4) In Supabase → Authentication → URL Configuration, add your site URL
 *    (e.g. https://yourdomain.com) to "Site URL" / "Redirect URLs" so the
 *    post-login redirect is allowed.
 * ─────────────────────────────────────────────────────────────────────────── */
