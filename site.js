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
