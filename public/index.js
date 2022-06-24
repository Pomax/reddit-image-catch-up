const fngen = (retval) => {
  return () => {
    document.querySelectorAll("input[type=checkbox]").forEach((e) => {
      e.checked = retval;
    });
  };
};

document.querySelector("#none").addEventListener("click", fngen(false));
document.querySelector("#all").addEventListener("click", fngen(true));
document.querySelector("#all").click();

const media = document.querySelectorAll(".entry");

media.forEach((entry) => {
  entry.addEventListener("mousedown", (evt) => {
    if (evt.which !== 1) {
      document.oncontextmenu = () => false;
      evt.stopPropagation();
      box = entry.getBoundingClientRect();
      entry.parentNode.style.width = box.width + "px";
      entry.parentNode.style.height = box.height + "px";
      entry.classList.add("zoomed");
    }
  });
});

document.addEventListener("mouseup", (evt) => {
  media.forEach((entry) => entry.classList.remove("zoomed"));
  setTimeout(() => (document.oncontextmenu = () => true), 100);
});

document.querySelectorAll(`video`).forEach((e) => {
  e.addEventListener(`mouseover`, (evt) => {
    if (e.paused) e.play();
  });
  e.addEventListener(`mouseout`, (evt) => {
    if (!e.paused) e.pause();
  });
});

document.querySelector(`#img-only`).addEventListener(`click`, (evt) => {
  document
    .querySelectorAll(`fieldset[data-type="video"]`)
    .forEach((e) => e.classList.add(`hidden`));
  document
    .querySelectorAll(`fieldset[data-type="img"]`)
    .forEach((e) => e.classList.remove(`hidden`));
  document.getElementById(`done`).classList.remove(`hidden`);
});

document.querySelector(`#video-only`).addEventListener(`click`, (evt) => {
  document
    .querySelectorAll(`fieldset[data-type="img"]`)
    .forEach((e) => e.classList.add(`hidden`));
  document
    .querySelectorAll(`fieldset[data-type="video"]`)
    .forEach((e) => e.classList.remove(`hidden`));
  document.getElementById(`done`).classList.add(`hidden`);
});

document.querySelector(`#img-only`).click();
