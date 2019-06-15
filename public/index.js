const fngen = retval => {
  return () => {
    document.querySelectorAll("input[type=checkbox]").forEach(e => {
      e.checked = retval;
    });
  };
};

document.querySelector("#none").addEventListener("click", fngen(false));
document.querySelector("#all").addEventListener("click", fngen(true));
document.querySelector("#all").click();

const images = document.querySelectorAll("img");

images.forEach(img => {
  img.addEventListener("mousedown", evt => {
    if (evt.which !== 1) {
      document.oncontextmenu = () => false;
      box = img.getBoundingClientRect();
      img.parentNode.style.width = box.width + "px";
      img.parentNode.style.height = box.height + "px";
      img.classList.add("zoomed");
    }
  });
});

document.addEventListener("mouseup", evt => {
  images.forEach(img => img.classList.remove("zoomed"));
  setTimeout(() => (document.oncontextmenu = () => true), 100);
});
