(function () {
  'use strict';

  // UI fixtures only. These are synthetic marketing examples, not an endurance model.
  const conditions = Object.freeze({
    nominal: { label: 'Nominal', wind: '7 mph', temperature: '64°F', rangeAt74: 14.2, initialCharge: 74 },
    headwind: { label: 'Headwind', wind: '24 mph', temperature: '64°F', rangeAt74: 9.1, initialCharge: 74 },
    cold: { label: 'Cold weather', wind: '7 mph', temperature: '23°F', rangeAt74: 10.5, initialCharge: 74 },
    low: { label: 'Low energy', wind: '7 mph', temperature: '64°F', rangeAt74: 14.2, initialCharge: 32 }
  });

  function getDisplay(physicalCharge, conditionKey) {
    const numeric = Number(physicalCharge);
    const physical = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    const condition = conditions[conditionKey] || conditions.nominal;
    const usableFraction = Math.max(0, physical - 20) / 80;
    const usable = Math.round(usableFraction * 100);
    // Deliberately simple interpolation between fictional UI fixture values.
    const range = (Math.max(0, physical - 20) / 54 * condition.rangeAt74).toFixed(1);
    const status = physical <= 20 ? 'reserve' : usableFraction <= 0.2 ? 'low' : 'normal';
    return { physical, usable, range, status, condition, fill: Math.max(0, physical - 20) };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { getDisplay, conditions };
  if (typeof document === 'undefined') return;

  const byId = (id) => document.getElementById(id);
  const simulator = byId('simulator');
  const slider = byId('charge-slider');
  const scenarioButtons = [...document.querySelectorAll('[data-scenario]')];
  let scenario = 'nominal';

  function renderDisplay() {
    const display = getDisplay(slider.value, scenario);
    byId('battery-value').textContent = display.usable;
    byId('range-value').textContent = display.range;
    byId('raw-charge').textContent = display.physical;
    byId('charge-output').textContent = display.physical + '%';
    byId('energy-fill').style.width = display.fill + '%';
    byId('battery-meter').setAttribute('aria-valuenow', String(display.physical));
    byId('battery-meter').setAttribute('aria-valuetext', display.physical + '% physical charge; ' + display.usable + '% usable mission energy');
    byId('wind-value').textContent = display.condition.wind;
    byId('temperature-value').textContent = display.condition.temperature;
    byId('condition-value').textContent = display.condition.label;
    simulator.classList.toggle('is-low', display.status !== 'normal');

    const notices = {
      normal: { status: 'Energy available', title: 'Energy available for flight', description: 'Your physical reserve is excluded from the usable estimate.', code: 'NORMAL', icon: '#i-check' },
      low: { status: 'Low mission energy', title: 'Return to base', description: 'Mission energy is low. The 20% physical reserve remains protected.', code: 'RETURN', icon: '#i-alert' },
      reserve: { status: 'Reserve reached', title: 'No mission energy remaining', description: 'Physical charge is at or below the protected 20% reserve.', code: 'RESERVE', icon: '#i-alert' }
    };
    const notice = notices[display.status];
    byId('flight-status').textContent = notice.status;
    byId('alert-title').textContent = notice.title;
    byId('alert-description').textContent = notice.description;
    byId('alert-code').textContent = notice.code;
    byId('alert-icon').querySelector('use').setAttribute('href', notice.icon);
  }

  function selectScenario(key) {
    if (!conditions[key]) return;
    scenario = key;
    slider.value = conditions[key].initialCharge;
    scenarioButtons.forEach((button) => {
      const selected = button.dataset.scenario === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderDisplay();
  }

  scenarioButtons.forEach((button) => button.addEventListener('click', () => selectScenario(button.dataset.scenario)));
  slider.addEventListener('input', renderDisplay);
  document.querySelectorAll('[data-reserve-demo]').forEach((link) => link.addEventListener('click', () => selectScenario('low')));
  renderDisplay();

  const inputContent = {
    wind: { number: '01', kicker: 'The air is never static.', description: 'A headwind changes what the same charge can deliver. Wind conditions add context to the energy estimate, beyond what battery measurements alone can show.', path: 'M100 65 240 130' },
    route: { number: '02', kicker: 'The next leg changes the picture.', description: 'A climb, a turn, or a longer route asks something different of the battery. Planned flight paths and maneuvers are part of our proposed estimation approach.', path: 'M460 56 354 122' },
    history: { number: '03', kicker: 'Every battery has a history.', description: 'Past flights, charge cycles, and degradation influence the energy a pack can deliver. Usage history helps put today’s battery readings in context.', path: 'M150 208 248 137' },
    battery: { number: '04', kicker: 'Start with the pack. Look beyond it.', description: 'Battery properties and health remain the foundation. Our concept adds environmental and flight information to those measurements for a fuller picture.', path: 'M508 160 352 137' },
    weather: { number: '05', kicker: 'Conditions change. Energy changes.', description: 'Temperature and outside weather conditions affect battery behavior and flight demand. They belong in the estimate, not just in the preflight briefing.', path: 'M354 218 318 158' }
  };
  const inputTabs = [...document.querySelectorAll('[data-input]')];

  function selectInput(tab) {
    const key = tab.dataset.input;
    const content = inputContent[key];
    inputTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    byId('context-panel').setAttribute('aria-labelledby', tab.id);
    byId('context-number').textContent = content.number;
    byId('context-kicker').textContent = content.kicker;
    byId('context-description').textContent = content.description;
    byId('active-model-line').setAttribute('d', content.path);
    document.querySelectorAll('[data-model-label]').forEach((label) => {
      label.style.color = label.dataset.modelLabel === key ? 'var(--gold)' : '#b3a07c';
    });
  }

  inputTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectInput(tab));
    tab.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowDown') target = (index + 1) % inputTabs.length;
      if (event.key === 'ArrowUp') target = (index + inputTabs.length - 1) % inputTabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = inputTabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        selectInput(inputTabs[target]);
        inputTabs[target].focus();
      }
    });
  });

  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = byId('mobile-nav');
  function setMenu(open) {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileNav.hidden = !open;
  }
  menuToggle.addEventListener('click', () => setMenu(mobileNav.hidden));
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileNav.hidden) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches) setMenu(false); });

  const dialog = byId('contact-dialog');
  let contactOpener;
  document.querySelectorAll('[data-contact]').forEach((button) => button.addEventListener('click', () => {
    contactOpener = button;
    setMenu(false);
    dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (contactOpener && !contactOpener.closest('[hidden]')) contactOpener.focus();
    else menuToggle.focus();
  });

  if ('IntersectionObserver' in window) {
    const navLinks = [...document.querySelectorAll('.desktop-nav a')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const selected = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', selected);
          if (selected) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    ['technology', 'demo', 'mission', 'team'].forEach((id) => observer.observe(byId(id)));
  }
})();
