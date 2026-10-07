// A phone-link click is an engagement event, never proof of a completed call.
// No conversion label or visitor contact details are sent.
document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener('click', () => {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'phone_click', { service_page: window.location.pathname });
      }
    } catch { /* Tracking must never interfere with calling the team. */ }
  });
});
