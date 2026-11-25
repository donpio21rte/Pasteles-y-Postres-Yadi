import { business, categories, products, reviews, gallery } from './content.js';

const $ = (selector) => document.querySelector(selector);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const imageUrl = (name) => `assets/${name}.webp`;
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const productById = new Map(products.map((product) => [product.id, product]));
const whatsappUrl = (message = '') => `https://wa.me/${business.whatsapp}${message ? '?text=' + encodeURIComponent(message) : ''}`;
const cart = $('#cart');
const cartItems = $('#cart-items');
const orderButton = $('#send-order');
const filterGroup = $('#filters');
const productGrid = $('#products');
const photoDialog = $('#photo-dialog');
const storageKey = 'pasteles-yadi-order-v1';
let activeCategory = 'all';
let quantities = new Map();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  quantities = new Map(Object.entries(stored || {}).filter(([id, count]) =>
    productById.has(id) && Number.isSafeInteger(count) && count > 0 && count <= 99));
} catch {
  // Ordering remains available when storage is disabled or invalid.
}

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) {
          target.classList.add('visible');
          observer.unobserve(target);
        }
      }
    }, { threshold: .12 })
  : null;

$('#categories').innerHTML = categories.map(({ id, name, image }, index) =>
  `<a class="category-card reveal" href="#catalogo" data-category="${id}" style="--delay:${index * 65}ms"><span class="image-frame"><img src="${imageUrl(image)}" alt="" loading="lazy" width="512" height="512"></span><strong>${name}<span aria-hidden="true">→</span></strong></a>`).join('');

filterGroup.innerHTML = [{ id: 'all', name: 'Todos' }, ...categories].map(({ id, name }) =>
  `<button class="filter" type="button" data-category="${id}" aria-pressed="${id === activeCategory}">${name}</button>`).join('');

const cards = new Map(products.map(({ id, name, image, description, price }) => {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.innerHTML = `<img src="${imageUrl(image)}" alt="${name}" loading="lazy" width="512" height="512"><div class="product-info"><h3>${name}</h3><p>${description}</p><div class="product-buy"><strong>${money.format(price)} MXN</strong><button class="button outline" type="button" data-product="${id}" aria-label="Agregar ${name} a mi pedido">Agregar <span aria-hidden="true">+</span></button></div></div>`;
  return [id, card];
}));
productGrid.append(...cards.values());

function filterProducts(category, animate = true) {
  const previousPositions = new Map();
  if (animate && !motionPreference.matches) {
    for (const [id, card] of cards) {
      if (!card.hidden) previousPositions.set(id, card.getBoundingClientRect());
    }
  }
  activeCategory = category;
  for (const button of filterGroup.children) {
    button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory));
  }
  let visibleCount = 0;
  for (const [id, card] of cards) {
    card.getAnimations().forEach((animation) => animation.cancel());
    card.hidden = category !== 'all' && productById.get(id).category !== category;
    if (!card.hidden) visibleCount++;
  }
  if (animate) $('#filter-status').textContent = `${visibleCount} productos disponibles.`;
  if (!animate || motionPreference.matches) return;

  const frames = [...cards].filter(([, card]) => !card.hidden).map(([id, card]) => {
    const previous = previousPositions.get(id);
    const current = card.getBoundingClientRect();
    const start = previous
      ? { transform: `translate(${previous.x - current.x}px, ${previous.y - current.y}px)` }
      : { transform: 'translateY(9px)', opacity: 0 };
    return [card, start];
  });
  for (const [card, start] of frames) {
    card.animate([start, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'ease-out' });
  }
}
filterProducts('all', false);

filterGroup.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (button && button.dataset.category !== activeCategory) filterProducts(button.dataset.category);
});
$('#categories').addEventListener('click', (event) => {
  const link = event.target.closest('[data-category]');
  if (link && link.dataset.category !== activeCategory) filterProducts(link.dataset.category);
});

function renderCart() {
  $('#cart-count').textContent = [...quantities.values()].reduce((sum, count) => sum + count, 0);
  let total = 0;
  cartItems.innerHTML = [...quantities].map(([id, count]) => {
    const { name, price } = productById.get(id);
    total += price * count;
    return `<div class="cart-row"><div><strong>${name}</strong><small>${money.format(price * count)} MXN</small></div><div class="quantity"><button type="button" data-id="${id}" data-step="-1" aria-label="Quitar una unidad de ${name}">−</button><span>${count}</span><button type="button" data-id="${id}" data-step="1" aria-label="Agregar una unidad de ${name}">+</button></div></div>`;
  }).join('') || '<p>Tu pedido está vacío.</p>';
  $('#cart-total').textContent = `${money.format(total)} MXN`;
  orderButton.disabled = quantities.size === 0;
}
function changeQuantity(id, step) {
  const count = Math.min((quantities.get(id) || 0) + step, 99);
  if (count > 0) quantities.set(id, count);
  else quantities.delete(id);
  try {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(quantities)));
  } catch {
    // The current order stays available in memory.
  }
  renderCart();
  return count;
}
renderCart();

const announcement = $('#announcement');
productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-product]');
  if (!button) return;
  const id = button.dataset.product;
  const count = changeQuantity(id, 1);
  announcement.textContent = `${count} en tu pedido: ${productById.get(id).name}.`;
});
$('[data-open-cart]').addEventListener('click', () => cart.showModal());
cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  const { id, step } = button.dataset;
  changeQuantity(id, Number(step));
  const replacement = [...cartItems.querySelectorAll('button')].find((control) =>
    control.dataset.id === id && control.dataset.step === step);
  (replacement || cartItems.querySelector('button') || cart.querySelector('.icon-button')).focus();
});
orderButton.addEventListener('click', () => {
  const lines = [...quantities].map(([id, count]) => `• ${count} × ${productById.get(id).name}`);
  window.open(whatsappUrl(['Hola, Yadi. Me gustaría cotizar este pedido:', ...lines,
    `Total de referencia: ${$('#cart-total').textContent}`, '¿Me puedes confirmar precio y disponibilidad?'].join('\n')), '_blank', 'noopener');
  $('#cart-status').textContent = 'Revisa el mensaje y envíalo desde WhatsApp para confirmar disponibilidad.';
});

const reviewCards = reviews.map((quote) => `<article class="review"><span class="stars" aria-hidden="true">★★★★★</span><blockquote>“${quote}”</blockquote><cite>Reseña ilustrativa</cite></article>`).join('');
$('#reviews').innerHTML = `<div class="review-track"><div class="review-set">${reviewCards}</div><div class="review-set" aria-hidden="true">${reviewCards}</div></div>`;
const reviewToggle = $('.review-toggle');
reviewToggle.addEventListener('click', () => {
  const paused = $('#reviews').classList.toggle('paused');
  reviewToggle.setAttribute('aria-pressed', String(paused));
  reviewToggle.textContent = paused ? 'Reanudar reseñas' : 'Pausar reseñas';
});
$('#gallery').innerHTML = gallery.map(({ image, name }, index) =>
  `<button type="button" class="reveal" data-photo="${index}" style="--delay:${index * 65}ms" aria-label="Ampliar foto: ${name}"><img src="${imageUrl(image)}" alt="" loading="lazy" width="512" height="512"><span aria-hidden="true">→</span></button>`).join('');
$('#gallery').addEventListener('click', (event) => {
  const button = event.target.closest('[data-photo]');
  if (!button) return;
  const { image, name } = gallery[button.dataset.photo];
  const photo = photoDialog.querySelector('img');
  photo.src = imageUrl(image);
  photo.alt = name;
  photoDialog.showModal();
});

const form = $('#contact-form');
document.querySelectorAll('[data-quote]').forEach((link) => {
  link.addEventListener('click', () => { form.elements.motivo.value = 'Pastel personalizado'; });
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const message = ['Hola, Yadi. Me gustaría solicitar una cotización.',
    `Nombre: ${values.nombre}`, `Correo: ${values.correo}`, `Motivo: ${values.motivo}`,
    ...(values.fecha ? [`Fecha del evento: ${values.fecha}`] : []), values.mensaje].join('\n');
  window.open(whatsappUrl(message), '_blank', 'noopener');
  $('#contact-status').textContent = 'Tu solicitud está preparada. Revisa el mensaje y envíalo desde WhatsApp.';
});

const whatsapp = $('#whatsapp');
whatsapp.href = whatsappUrl('Hola, Yadi. Me gustaría hacer una consulta.');
whatsapp.target = '_blank';
whatsapp.rel = 'noopener';
whatsapp.title = 'Escribir por WhatsApp';
whatsapp.setAttribute('aria-label', whatsapp.title);
$('#instagram').href = business.instagram;
$('#instagram').hidden = !business.instagram;
if (business.facebookUrl) {
  $('#facebook').href = business.facebookUrl;
  $('#facebook').hidden = false;
}
if (business.address) $('#location-address').textContent = business.address;
if (business.hours) $('#location-hours').textContent = business.hours;
if (business.mapUrl) {
  $('#map-link').href = business.mapUrl;
  $('#map-link').hidden = false;
}
$('#year').textContent = new Date().getFullYear();

const menu = $('.menu-toggle');
const nav = $('#navigation');
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});

if (revealObserver) {
  document.documentElement.classList.add('motion');
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
}
const header = $('.header');
const heroPhoto = $('.hero-photo');
const storyPhoto = $('.story-photo');
let scrollFrame;
function updateScroll() {
  scrollFrame = undefined;
  header.classList.toggle('scrolled', scrollY > 12);
  const heroOffset = motionPreference.matches ? 0 : Math.min(scrollY * .045, 12);
  const storyOffset = motionPreference.matches ? 0
    : Math.max(-12, Math.min(12, (innerHeight * .45 - storyPhoto.getBoundingClientRect().top) * .03));
  heroPhoto.style.setProperty('--parallax', `${heroOffset}px`);
  storyPhoto.style.setProperty('--parallax', `${storyOffset}px`);
}
function scheduleScroll() {
  if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateScroll);
}
window.addEventListener('scroll', scheduleScroll, { passive: true });
window.addEventListener('resize', scheduleScroll, { passive: true });
motionPreference.addEventListener('change', scheduleScroll);
updateScroll();
