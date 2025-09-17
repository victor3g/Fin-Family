document.addEventListener("DOMContentLoaded", () => {
  const switchTela = document.querySelector("#switchTela");
  const switchTela2 = document.querySelector("#switchTela2");
  const tela1 = document.querySelector(".tela1");
  const tela2 = document.querySelector(".tela2");

  function toggleTelas() {
    tela1.classList.toggle("active");
    tela2.classList.toggle("active");
    switchTela.classList.toggle("on");
    switchTela2.classList.toggle("on");
  }

  switchTela.addEventListener("click", toggleTelas);
  switchTela2.addEventListener("click", toggleTelas);
});
