import { createClient } from '@supabase/supabase-js';
import { sampleTexts } from './sample.js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const demo = import.meta.env.DEV && import.meta.env.MODE === 'demo';
const demoArchive = import.meta.env.DEV && import.meta.env.VITE_DEMO_CATALOGUE;
const resetRequested = new URLSearchParams(location.search).get('recover') === '1';
const authCallback = new URLSearchParams(location.hash.slice(1));
const supabase = !demo && url && key ? createClient(url, key) : null;
const app = document.querySelector('#app');
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const entryView = () => location.hash === '#claim' ? 'claim' : 'sign-in';
let view = demo ? entryView() : 'loading';
let email = '';
let user = null;
let texts = [];
let watched = new Set();
let recovery = false;
let authPending = false;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const label = escapeHtml;
const date = (value) => value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : '';
const textLink = (text, sitting) => `#text/${encodeURIComponent(text.id)}${sitting ? `/${encodeURIComponent(sitting.id)}` : ''}`;

const authViews = {
  'sign-in': ['Return to the circle', 'Sign in to find your sittings and reading resources.'],
  claim: ['Claim your account', 'Enter the email address you used to join Briggs’ Book Club.'],
  verify: ['Check your email', 'Enter the one-time code to confirm your book club email.'],
  finish: ['Make it yours', 'Your email is verified. Choose a username and password.'],
  forgot: ['Reset your password', 'We’ll send a reset link to your book club email.'],
  reset: ['Choose a new password', 'Enter the new password you want to use for your account.'],
  'reset-expired': ['Request a new reset link', 'This password reset link is missing, expired or already used.'],
  blocked: ['Check your membership', 'This email no longer has access. Contact the club if you think this is a mistake.'],
};

function field(name, title, type, autocomplete, attributes = '') {
  return `<label>${title}<input name="${name}" type="${type}" autocomplete="${autocomplete}" ${attributes} required></label>`;
}

function authForm() {
  const emailField = field('email', 'Email address', 'email', 'email', `maxlength="254" value="${label(email)}"`);
  const password = field('password', 'Password', 'password', 'new-password', 'minlength="8"');
  const username = field('username', 'Username', 'text', 'username', 'minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]+" autocapitalize="none"');
  const actions = {
    'sign-in': [emailField + field('password', 'Password', 'password', 'current-password'), 'Sign in'],
    claim: [emailField, 'Send verification code'],
    verify: [field('code', 'Verification code', 'text', 'one-time-code', 'inputmode="numeric" pattern="[0-9]{6,10}" maxlength="10"'), 'Verify email'],
    finish: [username + '<p class="hint">Use 3–24 letters, numbers or underscores.</p>' + password + '<p class="hint">Use at least 8 characters.</p>', 'Enter the library'],
    forgot: [emailField, 'Send reset link'],
    reset: [password, 'Save password'],
  };
  const action = actions[view];
  const [title, detail] = authViews[view];
  const form = action ? `<form id="auth-form"><fieldset>${action[0]}<button class="button" type="submit">${action[1]}</button></fieldset><p class="feedback" role="status" id="form-message"></p></form>` : '';
  return `<div class="entry"><aside class="entry-cover"><span class="eyebrow">A circle of sacred reading</span><span class="cover-ornament" aria-hidden="true">✳</span><p>Read.<br> Reflect.<br> Remember.</p><span class="cover-foot">Briggs’ Book Club</span></aside>
    <section class="entry-form"><p class="eyebrow">Members’ replay library</p><h1>${title}</h1><p class="lede">${detail}${view === 'verify' ? ` The code was sent to <strong class="claim-email">${label(email)}</strong>.` : ''}</p>${form}
    ${view === 'sign-in' ? '<div class="entry-links"><button class="text-button" data-view="claim">Claim your account</button><button class="text-button" data-view="forgot">Forgot password?</button></div>' : ''}
    ${['claim', 'forgot'].includes(view) ? '<button class="text-button" data-view="sign-in">Back to sign in</button>' : ''}
    ${view === 'verify' ? '<div class="entry-links"><button class="text-button" data-action="resend">Send code again</button><button class="text-button" data-view="claim">Change email</button></div>' : ''}
    ${view === 'reset-expired' ? '<button class="button" data-view="forgot">Request a new link</button>' : ''}
    ${['finish', 'blocked'].includes(view) ? '<button class="text-button" data-action="sign-out">Sign out</button>' : ''}
    ${demo ? '<div class="preview-entry"><span>Local preview</span><button class="text-button" data-action="demo">Explore the library →</button></div>' : ''}
    </section></div>`;
}

function textCards() {
  return texts.map((text, index) => {
    const complete = text.sittings.filter((sitting) => watched.has(sitting.id)).length;
    return `<a class="text-card" href="${textLink(text)}"><div class="bookplate bookplate-${index % 2}" aria-hidden="true"><span>✳</span><span>${String(index + 1).padStart(2, '0')}</span></div><div><h3>${label(text.title)}</h3><p>${label(text.subtitle)}</p><small>${complete} of ${text.sittings.length} sittings watched</small></div><span class="card-arrow" aria-hidden="true">→</span></a>`;
  }).join('');
}

function nextUnwatched(text) {
  return text.sittings.find((sitting) => !watched.has(sitting.id));
}

function library() {
  const nextText = texts.find(nextUnwatched);
  const featuredText = nextText || texts.find((text) => text.sittings.length);
  const featured = featuredText && (nextUnwatched(featuredText) || featuredText.sittings[0]);
  return `<div class="page library-page"><section class="library-heading"><div><p class="eyebrow"><span aria-hidden="true">✳</span> The reading circle</p><h1>Replay library</h1><p class="lede">Pick up with the next sitting or return to a text below.</p></div>${texts.length ? '<button class="button secondary" data-action="browse">Browse all texts <span aria-hidden="true">↓</span></button>' : ''}</section>
    ${featured ? `<section aria-label="${nextText ? 'Continue watching' : 'Watch again'}"><div class="featured-heading"><p class="eyebrow">${nextText ? 'Continue watching' : 'Watch again'}</p><h2>${label(featuredText.title)}</h2></div>${sittingPanel(featuredText, featured)}</section>` : '<p class="empty-library">Replays will appear here once recordings are added.</p>'}
    ${texts.length ? `<section class="texts"><h2 id="texts-heading" tabindex="-1">The Texts</h2><div class="text-grid">${textCards()}</div></section>` : ''}</div>`;
}

function sittingSidebar(text, sitting) {
  const completed = text.sittings.filter((item) => watched.has(item.id)).length;
  const resources = text.resources.filter((resource) => /^https:\/\//i.test(resource.url)).map((resource) => `<li><a href="${label(resource.url)}" target="_blank" rel="noopener noreferrer">${label(resource.title)} ↗</a></li>`).join('');
  return `<aside class="course-sidebar"><section><div class="list-heading"><h2>Sittings</h2><p>${completed} of ${text.sittings.length} watched</p></div>
    <ol class="sitting-list">${text.sittings.map((item, i) => `<li><a href="${textLink(text, item)}" ${item.id === sitting?.id ? 'aria-current="true"' : ''}><span class="sitting-number">${watched.has(item.id) ? '<span aria-label="Watched">✓</span>' : String(i + 1).padStart(2, '0')}</span><span>${label(item.title)}${item.recorded_on ? `<small>${date(item.recorded_on)}</small>` : ''}</span></a></li>`).join('')}</ol></section>
    <section class="resources"><h2>Resources</h2>${resources ? `<ul>${resources}</ul>` : '<p>Reading guides and translation instalments will appear here.</p>'}</section></aside>`;
}

function sittingPanel(text, sitting) {
  const currentWatched = sitting && watched.has(sitting.id);
  const drive = sitting && (!demo || demoArchive) ? `https://drive.google.com/file/d/${encodeURIComponent(sitting.id)}` : '';
  const player = drive ? `<iframe class="player" src="${drive}/preview" title="Replay of ${label(sitting.title)}" allow="fullscreen" allowfullscreen></iframe>` : `<div class="player placeholder"><span aria-hidden="true">✳</span><p>${sitting ? 'Sample sitting' : 'No sittings yet'}</p></div>`;
  return `<div class="course-layout"><section class="watch-pane" aria-label="Selected sitting">${player}
    ${sitting ? `<div class="watch-details"><div>${sitting.recorded_on ? `<p class="eyebrow">${date(sitting.recorded_on)}</p>` : ''}<h2>${label(sitting.title)}</h2></div><button class="button secondary" aria-pressed="${Boolean(currentWatched)}" data-action="watched" data-text="${label(text.id)}" data-sitting="${label(sitting.id)}">${currentWatched ? '✓ Watched' : 'Mark as watched'}</button></div>` : ''}
    ${drive ? `<a class="back" href="${drive}/view" target="_blank" rel="noopener noreferrer">Open in Drive ↗</a>` : ''}<p class="feedback" role="status" id="watch-message"></p></section>
    ${sittingSidebar(text, sitting)}</div>`;
}

function textPage(text, sittingId) {
  const sitting = text.sittings.find((item) => encodeURIComponent(item.id) === sittingId) || nextUnwatched(text) || text.sittings[0];
  return `<div class="page course-page"><a class="back" href="#library">← Replay library</a><header class="course-heading"><p class="eyebrow">The texts</p><h1>${label(text.title)}</h1><p class="lede">${label(text.subtitle)}</p></header>${sittingPanel(text, sitting)}</div>`;
}

function render() {
  const [, textId, sittingId] = location.hash.split('/');
  const selected = texts.find((text) => encodeURIComponent(text.id) === textId);
  const content = view === 'library' ? (selected ? textPage(selected, sittingId) : library())
    : view === 'loading' ? '<div class="page"><p role="status">Opening the library…</p></div>'
    : view === 'error' ? '<div class="page"><h1>The library is unavailable</h1><p>Reload to try again, or contact the club if the problem continues.</p></div>'
    : authForm();
  app.innerHTML = `<header class="site-header"><div class="header-inner"><a class="wordmark" href="${view === 'library' ? '#library' : 'https://www.briggsbook.club/'}">Briggs’ Book Club</a><div class="header-actions">${view === 'library' ? `<span class="member-label">${demo ? 'Design preview' : label(user?.username)}</span><button class="text-button" data-action="sign-out">${demo ? 'Exit preview' : 'Sign out'}</button>` : '<a class="text-button" href="https://www.briggsbook.club/">Club homepage ↗</a>'}</div></div></header><main id="main" tabindex="-1">${content}</main><footer class="site-footer">Briggs’ Book Club <span aria-hidden="true">✳</span> Read. Reflect. Remember.</footer>`;
}

function show(next, focus = true) {
  view = next;
  render();
  if (focus) {
    document.querySelector('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function goLibrary() {
  if (!location.hash.startsWith('#text/')) history.replaceState(null, '', '#library');
  show('library');
}

async function openMember(sessionUser) {
  const { data: allowed, error: accessError } = await supabase.rpc('member_has_access');
  if (accessError) throw accessError;
  if (!allowed) return show('blocked');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('username').eq('id', sessionUser.id).maybeSingle();
  if (profileError) throw profileError;
  user = { id: sessionUser.id, username: profile?.username };
  if (!profile) return show('finish');
  const [catalogue, progress] = await Promise.all([
    supabase.from('texts').select('id,title,subtitle,sittings(id,title,recorded_on),resources(id,title,url)').order('position').order('id').order('position', { referencedTable: 'sittings' }).order('recorded_on', { referencedTable: 'sittings' }).order('id', { referencedTable: 'sittings' }).order('id', { referencedTable: 'resources' }),
    supabase.from('watched').select('sitting_id').eq('member_id', user.id),
  ]);
  if (catalogue.error || progress.error) throw catalogue.error || progress.error;
  texts = catalogue.data;
  watched = new Set(progress.data.map((item) => item.sitting_id));
  goLibrary();
}

async function saveProfile(sessionUser, details) {
  const { data: allowed, error: accessError } = await supabase.rpc('member_has_access');
  if (accessError) throw accessError;
  if (!allowed) return show('blocked');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id').eq('id', sessionUser.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    const { error: passwordError } = await supabase.auth.updateUser({ password: details.password });
    if (passwordError && passwordError.code !== 'same_password') throw passwordError;
    const { error } = await supabase.from('profiles').insert({ id: sessionUser.id, username: details.username });
    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await supabase.from('profiles').select('id').eq('id', sessionUser.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return openMember(sessionUser);
      document.querySelector('#form-message').textContent = 'That username is taken. Choose another and use the password you just entered.';
      return;
    }
    if (error) throw error;
  }
  await openMember(sessionUser);
}

async function sendCode() {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

function resetUrl() {
  const target = new URL(location.pathname, location.origin);
  target.searchParams.set('recover', '1');
  return target;
}

function clearResetUrl() {
  const current = new URL(location.href);
  current.searchParams.delete('recover');
  current.hash = '';
  history.replaceState(null, '', current);
}

async function handleAuth(values) {
  email = String(values.get('email') || email).trim().toLowerCase();
  const password = values.get('password');
  const username = String(values.get('username') || '').toLowerCase();
  if (view === 'claim') {
    await sendCode();
    show('verify');
  } else if (view === 'verify') {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: values.get('code'), type: 'email' });
    if (error) throw error;
    await openMember(data.user);
  } else if (view === 'finish') {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    await saveProfile(data.user, { username, password });
  } else if (view === 'sign-in') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await openMember(data.user);
  } else if (view === 'forgot') {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl().href });
    if (error) throw error;
    document.querySelector('#form-message').textContent = 'If there’s an account for this email, a reset link is on its way.';
  } else if (view === 'reset') {
    const { data: allowed, error: accessError } = await supabase.rpc('member_has_access');
    if (accessError) throw accessError;
    if (!allowed) {
      clearResetUrl();
      return show('blocked');
    }
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    recovery = false;
    clearResetUrl();
    await openMember(data.user);
  }
}

function authError(error) {
  if (error.code === 'invalid_credentials') return 'Check your email and password and try again.';
  if (error.code === 'otp_expired' || error.code === 'invalid_otp') return 'That code has expired or doesn’t match. Use the latest code, or select Send code again.';
  if (error.status === 429) return 'Too many attempts. Wait at least a minute before trying again.';
  if (error.status === 403 || error.code === 'hook_payload_invalid') return 'Use the email you joined the book club with, or contact the organiser.';
  if (error.code === 'same_password') return 'Choose a password you haven’t just used.';
  if (error.code === 'weak_password') return 'Choose a stronger password and try again.';
  return 'Something went wrong. Try again in a moment.';
}

async function runAuth(form, action, extraButton) {
  if (authPending) return;
  const fields = form.querySelector('fieldset');
  const message = form.querySelector('.feedback');
  if (demo) {
    message.textContent = 'Account access is available once Supabase is connected. You can explore the sample library below.';
    return;
  }
  fields.disabled = true;
  if (extraButton) extraButton.disabled = true;
  authPending = true;
  message.textContent = '';
  try {
    await action(message);
  } catch (error) {
    message.textContent = authError(error);
  } finally {
    fields.disabled = false;
    if (extraButton) extraButton.disabled = false;
    authPending = false;
  }
}

app.addEventListener('submit', (event) => {
  if (event.target.id !== 'auth-form') return;
  event.preventDefault();
  const values = new FormData(event.target);
  void runAuth(event.target, () => handleAuth(values));
});

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || authPending) return;
  if (button.dataset.view) {
    if (view === 'reset-expired') clearResetUrl();
    show(button.dataset.view);
  }
  if (button.dataset.action === 'resend') {
    await runAuth(document.querySelector('#auth-form'), async (message) => {
      await sendCode();
      message.textContent = 'A new code is on its way. Use the most recent email.';
    }, button);
  }
  if (button.dataset.action === 'demo') openPreview();
  if (button.dataset.action === 'browse') document.querySelector('#texts-heading').focus();
  if (button.dataset.action === 'sign-out') {
    if (!demo) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return show('error');
    }
    clearLibrary();
  }
  if (button.dataset.action === 'watched') await toggleWatched(button);
});

function openPreview() {
  texts = demoArchive ? JSON.parse(demoArchive) : sampleTexts;
  try { watched = new Set(JSON.parse(localStorage.getItem('briggs-preview-watched') || '[]')); }
  catch { watched = new Set(); }
  goLibrary();
}

async function toggleWatched(button) {
  const memberAtStart = user;
  const id = button.dataset.sitting;
  const done = watched.has(id);
  button.disabled = true;
  try {
    if (!demo) {
      const row = { member_id: user.id, sitting_id: id };
      const table = supabase.from('watched');
      const { error } = await (done ? table.delete().match(row) : table.upsert(row, { ignoreDuplicates: true }));
      if (error) throw error;
      if (user !== memberAtStart) return;
    }
    if (done) watched.delete(id);
    else watched.add(id);
    if (demo) localStorage.setItem('briggs-preview-watched', JSON.stringify([...watched]));
    // Keep the embedded player mounted when a member ticks off a sitting.
    if (button.isConnected) {
      button.disabled = false;
      const main = document.querySelector('#main');
      const template = document.createElement('template');
      const text = texts.find((item) => item.id === button.dataset.text);
      template.innerHTML = sittingSidebar(text, text.sittings.find((item) => item.id === id));
      main.querySelector('.course-sidebar').replaceWith(template.content.querySelector('.course-sidebar'));
      const textGrid = main.querySelector('.text-grid');
      if (textGrid) textGrid.innerHTML = textCards();
      button.textContent = done ? 'Mark as watched' : '✓ Watched';
      button.setAttribute('aria-pressed', String(!done));
      main.querySelector('#watch-message').textContent = done ? 'Marked as unwatched.' : 'Progress saved.';
      button.focus();
    }
  } catch {
    const message = document.querySelector('#watch-message');
    if (message) message.textContent = 'Progress could not be saved. Try again.';
  } finally {
    button.disabled = false;
  }
}

function clearLibrary() {
  user = null;
  texts = [];
  watched = new Set();
  recovery = false;
  history.replaceState(null, '', location.pathname);
  show('sign-in');
}

window.addEventListener('hashchange', () => {
  if (view === 'library') show('library');
  else if (location.hash === '#claim' && !authPending && !user) show('claim');
});
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#main').focus();
});

if (demo && (location.hash === '#library' || location.hash.startsWith('#text/'))) openPreview();
else render();
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recovery = true;
      show('reset');
    }
    if (event === 'SIGNED_OUT' && view !== 'loading') clearLibrary();
  });
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (authCallback.get('type') === 'recovery' && data.session?.access_token &&
        data.session.access_token === authCallback.get('access_token')) recovery = true;
    if (resetRequested && !recovery) return show('reset-expired');
    if (error) throw error;
    if (recovery) show('reset');
    else if (data.session) await openMember(data.session.user);
    else show(entryView(), false);
  }).catch(() => show(resetRequested && !recovery ? 'reset-expired' : 'error'));
} else if (!demo) show('error');
