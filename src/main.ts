import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `<header class="topbar"><strong>Jaderka Rozvrh</strong></header>
  <main class="container"><p>Editor rozvrhu se připravuje.</p></main>`;
}
