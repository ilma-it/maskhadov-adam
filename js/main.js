/**
 * Main Application Logic for "Умная Теплица" Portfolio
 * Navigation, Touch Gestures, Lightbox Modal with Swipe, Scroll Animations & Charts
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initLightbox();
  initScrollAnimations();
  initMobileMenu();
  initChartsAnimation();
});

/* ==========================================================================
   1. NAVBAR & SCROLL SPY (3 Combined Pages: #hero, #gallery, #model3d)
   ========================================================================== */
function initNavbar() {
  const header = document.querySelector('.header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Scroll spy for combined sections
    let current = '';
    const scrollPos = window.pageYOffset + 220;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        current = section.getAttribute('id');
      }
    });

    if (current) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    }
  }, { passive: true });
}

/* ==========================================================================
   2. CHARTS ANIMATION
   ========================================================================== */
function initChartsAnimation() {
  const chartSection = document.querySelector('.benefits-section');
  if (!chartSection) return;

  const pillars = document.querySelectorAll('.bar-pillar');
  const originalHeights = Array.from(pillars).map(p => p.style.height);

  // Set initial height to 0
  pillars.forEach(p => {
    p.style.height = '0%';
  });

  const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        pillars.forEach((p, idx) => {
          setTimeout(() => {
            p.style.height = originalHeights[idx];
          }, idx * 70);
        });
        chartObserver.unobserve(chartSection);
      }
    });
  }, { threshold: 0.1 });

  chartObserver.observe(chartSection);

  // Detail button handler
  const btnDetail = document.getElementById('btnDetailDonut');
  if (btnDetail) {
    btnDetail.addEventListener('click', () => {
      alert('Вклад в устойчивое развитие:\n• 45% Снижение углеродного следа\n• 30% Возобновляемая солнечная энергия\n• 15% Рециркуляция водных ресурсов\n• 10% Биоразлагаемые компоненты');
    });
  }
}

/* ==========================================================================
   3. LIGHTBOX MODAL WITH MOBILE SWIPE SUPPORT
   ========================================================================== */
function initLightbox() {
  const lightbox = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  if (!lightbox) return;

  const galleryItems = Array.from(document.querySelectorAll('.gallery-frame-card'));
  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    const item = galleryItems[currentIndex];
    const img = item.querySelector('img');
    const title = item.getAttribute('data-title') || '';
    const desc = item.getAttribute('data-desc') || '';

    lightboxImg.src = img.src;
    lightboxCaption.textContent = title ? `${title} — ${desc}` : desc;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % galleryItems.length;
    openLightbox(currentIndex);
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
    openLightbox(currentIndex);
  }

  galleryItems.forEach((item, idx) => {
    item.addEventListener('click', () => openLightbox(idx));
  });

  closeBtn?.addEventListener('click', closeLightbox);
  nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });
  prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });

  // Mobile Touch Swipe Gesture Detection
  let touchStartX = 0;
  let touchStartY = 0;

  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Detect horizontal swipe
    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 80) {
      if (deltaX < 0) {
        showNext(); // Swipe left -> next photo
      } else {
        showPrev(); // Swipe right -> prev photo
      }
    }
  }, { passive: true });
}

/* ==========================================================================
   4. SCROLL ANIMATIONS
   ========================================================================== */
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.05,
    rootMargin: '0px 0px -30px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.module-card, .video-showcase-box, .gallery-frame-card, .benefit-card-pill, .analytics-panel-wrap').forEach(el => {
    observer.observe(el);
  });
}

/* ==========================================================================
   5. MOBILE MENU SMOOTH SCROLL
   ========================================================================== */
function initMobileMenu() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          targetElem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}