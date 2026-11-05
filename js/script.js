// INFO1005 Module 3.2 Marge Simpson multipage template JavaScript
// One shared file controls theme, typewriter, modal and demo form behaviour.

(function () {
  const html = document.documentElement;
  const switcher = document.querySelector('#themeSwitch');

  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('marge-theme') || 'light';
  } catch (error) {
    savedTheme = 'light';
  }

  html.setAttribute('data-bs-theme', savedTheme);

  if (switcher) {
    switcher.checked = savedTheme === 'dark';

    switcher.addEventListener('change', function () {
      const nextTheme = switcher.checked ? 'dark' : 'light';
      html.setAttribute('data-bs-theme', nextTheme);

      try {
        localStorage.setItem('marge-theme', nextTheme);
      } catch (error) {
        // Theme switching still works if storage is unavailable.
      }
    });
  }

  // HOME TYPEWRITER
  const typingTarget = document.querySelector('.typewrite');

  if (typingTarget) {
    const words = JSON.parse(typingTarget.dataset.words || '[]');
    let wordIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    function typeLoop() {
      const word = words[wordIndex] || '';

      characterIndex += deleting ? -1 : 1;
      typingTarget.textContent = word.slice(0, characterIndex);

      let delay = deleting ? 55 : 95;

      if (!deleting && characterIndex === word.length) {
        deleting = true;
        delay = 1200;
      } else if (deleting && characterIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        delay = 350;
      }

      window.setTimeout(typeLoop, delay);
    }

    if (words.length) {
      typeLoop();
    }
  }

  // PORTFOLIO MODAL
  const modalEl = document.getElementById('projectLightbox');

  if (modalEl) {
    const modalTitle = modalEl.querySelector('.modal-title');
    const modalImage = modalEl.querySelector('.lightbox-image');
    const modalText = modalEl.querySelector('.lightbox-text');

    document.querySelectorAll('[data-project-image]').forEach(function (button) {
      button.addEventListener('click', function () {
        modalTitle.textContent = button.dataset.projectTitle || 'Project preview';
        modalImage.src = button.dataset.projectImage || '';
        modalImage.alt = button.dataset.projectAlt || 'Project image preview';
        modalText.textContent = button.dataset.projectText || '';
      });
    });
  }

  // DEMO FORM VALIDATION
  document.querySelectorAll('.needs-validation').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      form.classList.add('was-validated');

      const status = form.querySelector('.form-status');

      if (status) {
        status.textContent = form.checkValidity()
          ? 'Demo only: your form is valid, but it is not connected to a database or email service.'
          : 'Please complete the required fields before submitting this demo form.';
      }
    });
  });
})();
