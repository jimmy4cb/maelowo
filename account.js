import { getProfile, isSupabaseConfigured, showMessage, supabase } from './supabase-client.js';

const globalMessage = document.getElementById('portal-message');

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function renderEntries(container, items, kind) {
  container.replaceChildren();
  if (!items.length) return;

  const heading = document.createElement('h3');
  heading.textContent = kind === 'review' ? 'Your recent reviews' : 'Your referrals';
  container.appendChild(heading);

  items.forEach((item) => {
    const entry = document.createElement('article');
    entry.className = 'portal-entry';
    const title = document.createElement('strong');
    const detail = document.createElement('p');
    const date = document.createElement('small');
    if (kind === 'review') {
      title.textContent = `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}`;
      detail.textContent = item.review;
    } else {
      title.textContent = item.friend_name;
      detail.textContent = item.friend_email;
    }
    date.textContent = formatDate(item.created_at);
    entry.append(title, detail, date);
    container.appendChild(entry);
  });
}

async function startAccount() {
  if (!isSupabaseConfigured) {
    showMessage(globalMessage, 'Client accounts require Supabase configuration. See SUPABASE_SETUP.md.', true);
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    window.location.replace('sign.html');
    return;
  }

  const profile = await getProfile(session.user.id);
  if (profile.role === 'admin') {
    window.location.replace('admin.html');
    return;
  }
  document.getElementById('client-name').textContent = profile.full_name || session.user.email;

  const reviewList = document.getElementById('my-reviews');
  const referralList = document.getElementById('my-referrals');

  async function loadEntries() {
    const [reviewsResult, referralsResult] = await Promise.all([
      supabase.from('service_reviews').select('rating, review, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('referrals').select('friend_name, friend_email, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10)
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
    if (referralsResult.error) throw referralsResult.error;
    renderEntries(reviewList, reviewsResult.data, 'review');
    renderEntries(referralList, referralsResult.data, 'referral');
  }

  await loadEntries();

  document.getElementById('review-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const status = document.getElementById('review-message');
    showMessage(status, '');
    try {
      const { error } = await supabase.from('service_reviews').insert({
        user_id: session.user.id,
        rating: Number(document.getElementById('rating').value),
        review: document.getElementById('review').value.trim()
      });
      if (error) throw error;
      event.currentTarget.reset();
      showMessage(status, 'Thank you. Your review has been saved.');
      await loadEntries();
    } catch (error) {
      showMessage(status, error.message || 'Your review could not be saved.', true);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById('referral-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const status = document.getElementById('referral-message-status');
    showMessage(status, '');
    try {
      const { error } = await supabase.from('referrals').insert({
        user_id: session.user.id,
        friend_name: document.getElementById('friend-name').value.trim(),
        friend_email: document.getElementById('friend-email').value.trim(),
        message: document.getElementById('referral-message').value.trim()
      });
      if (error) throw error;
      event.currentTarget.reset();
      showMessage(status, 'Referral saved. Thank you for recommending MaeLowo.');
      await loadEntries();
    } catch (error) {
      showMessage(status, error.message || 'Your referral could not be saved.', true);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById('sign-out').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(globalMessage, error.message, true);
      return;
    }
    window.location.replace('index.html');
  });
}

startAccount().catch((error) => {
  console.error('Unable to open the client account.', error);
  showMessage(globalMessage, error.message || 'Could not load the client account.', true);
});
