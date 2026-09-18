const menuButton = document.querySelector('.menu');
const navigation = document.querySelector('.links');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? '×' : '☰';
  });

  navigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = '☰';
    });
  });
}

const reviewViewport = document.querySelector('.review-viewport');
const reviewTrack = document.querySelector('.review-track');
const reviewCards = Array.from(document.querySelectorAll('.review-card'));
const reviewPrevious = document.querySelector('.review-prev');
const reviewNext = document.querySelector('.review-next');

if (reviewViewport && reviewTrack && reviewCards.length && reviewPrevious && reviewNext) {
  let reviewIndex = 0;
  let reviewTimer;

  const visibleReviews = () => {
    if (window.matchMedia('(max-width: 620px)').matches) return 1;
    if (window.matchMedia('(max-width: 900px)').matches) return 2;
    return 3;
  };

  const showReview = (requestedIndex) => {
    const maximumIndex = Math.max(0, reviewCards.length - visibleReviews());
    reviewIndex = requestedIndex > maximumIndex ? 0 : requestedIndex < 0 ? maximumIndex : requestedIndex;
    const cardWidth = reviewCards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(reviewTrack).gap) || 0;
    reviewTrack.style.transform = `translateX(-${reviewIndex * (cardWidth + gap)}px)`;
  };

  const stopReviewTimer = () => window.clearInterval(reviewTimer);
  const startReviewTimer = () => {
    stopReviewTimer();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reviewTimer = window.setInterval(() => showReview(reviewIndex + 1), 5000);
    }
  };

  reviewPrevious.addEventListener('click', () => {
    showReview(reviewIndex - 1);
    startReviewTimer();
  });

  reviewNext.addEventListener('click', () => {
    showReview(reviewIndex + 1);
    startReviewTimer();
  });

  reviewViewport.addEventListener('mouseenter', stopReviewTimer);
  reviewViewport.addEventListener('mouseleave', startReviewTimer);
  reviewViewport.addEventListener('focusin', stopReviewTimer);
  reviewViewport.addEventListener('focusout', startReviewTimer);
  window.addEventListener('resize', () => showReview(reviewIndex));

  showReview(0);
  startReviewTimer();
}


const websiteQuoteForm = document.querySelector('#website-quote-form');

if (websiteQuoteForm) {
  const websiteAgentApi = 'https://veracious-cat-969.convex.site';
  const websiteAgentSiteKey = 'wa_418f0e6d7ac042b6b355558959a65d13';

  websiteQuoteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!websiteQuoteForm.reportValidity()) return;

    const submitButton = websiteQuoteForm.querySelector('button[type="submit"]');
    const status = websiteQuoteForm.querySelector('.form-status');
    const data = new FormData(websiteQuoteForm);
    const files = Array.from(websiteQuoteForm.querySelector('#photos')?.files || []).slice(0, 5);
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const originalButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    status.textContent = 'Uploading your details securely…';

    try {
      const photoStorageIds = await Promise.all(files.map(async (file) => {
        const upload = new FormData();
        upload.append('siteKey', websiteAgentSiteKey);
        upload.append('sessionId', sessionId);
        upload.append('photo', file);
        const response = await fetch(`${websiteAgentApi}/api/v1/website-agent/upload`, { method: 'POST', body: upload });
        if (!response.ok) throw new Error('Photo upload failed');
        const result = await response.json();
        return result.storageId;
      }));

      const response = await fetch(`${websiteAgentApi}/api/v1/website-agent/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey: websiteAgentSiteKey,
          sessionId,
          name: String(data.get('name') || ''),
          phone: String(data.get('phone') || ''),
          email: String(data.get('email') || ''),
          suburb: String(data.get('suburb') || ''),
          address: String(data.get('address') || ''),
          service: String(data.get('service') || 'Electrical enquiry'),
          message: String(data.get('message') || ''),
          urgency: 'standard',
          leadScore: 0,
          photoStorageIds,
          transcript: 'Website quote form submission',
          sourceUrl: window.location.href,
        }),
      });

      if (!response.ok) throw new Error('Enquiry delivery failed');
      status.textContent = 'Enquiry sent successfully. Thank you!';
      window.location.assign('/thanks.html');
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
      status.textContent = 'We could not send your enquiry. Please try again or call 1300 692 333.';
    }
  });
}
