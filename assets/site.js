// Shared behavior for every Fihma Advisory page.
(function () {
  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Footer year
  document.querySelectorAll('.js-year').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // The one page-load moment: highlight the tasks that got handed off.
  var todo = document.querySelector('.todo');
  if (todo) {
    requestAnimationFrame(function () {
      setTimeout(function () { todo.classList.add('go'); }, 350);
    });
  }

  // Ask an AI about us
  document.querySelectorAll('[data-ask]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var prompt = 'Search up Fihma Advisory at fihmaadvisory.com and tell me who they are, what they do, and how to get in touch with them.';
      var q = encodeURIComponent(prompt);
      var urls = {
        chatgpt: 'https://chatgpt.com/?q=' + q,
        claude: 'https://claude.ai/new?q=' + q,
        perplexity: 'https://www.perplexity.ai/search?q=' + q,
        gemini: 'https://gemini.google.com/app?q=' + q
      };
      window.open(urls[btn.getAttribute('data-ask')], '_blank', 'noopener,noreferrer');
    });
  });

  // Submit via fetch: the thank-you page counts a lead only after Netlify confirms the POST succeeded.
  // A failed POST sets no flag and never reaches /thank-you, so it cannot count as a conversion.
  // Without JS the form still posts normally to Netlify (undercount, never a false lead).
  document.querySelectorAll('form[name="audit-request"], form[name="data-inquiry"]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(f);
      if (!data.get('form-name')) data.append('form-name', f.getAttribute('name'));
      var button = f.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
      }).then(function (res) {
        if (!res.ok) throw new Error('Submission failed with status ' + res.status);
        try { sessionStorage.setItem('fa_lead_form', JSON.stringify({ form: f.getAttribute('name'), t: Date.now() })); } catch (e2) {}
        window.location.assign('/thank-you');
      }).catch(function () {
        if (button) { button.disabled = false; button.textContent = button.getAttribute('data-label') || 'Send'; }
        alert('Your message did not send. Email max@fihmaadvisory.com or call (201) 289-0474 and we will pick it up from there.');
      });
    });
  });
})();
