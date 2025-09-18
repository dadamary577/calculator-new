// Simple typing effect
const typedWords = ["Content", "Blogs", "Stories", "Ideas"];
let i = 0, j = 0, current = "", isDeleting = false;
const typedEl = document.getElementById("typed");

function type() {
  current = typedWords[i];
  typedEl.textContent = current.substring(0, j);
  if (!isDeleting && j < current.length) {
    j++;
    setTimeout(type, 150);
  } else if (isDeleting && j > 0) {
    j--;
    setTimeout(type, 100);
  } else {
    isDeleting = !isDeleting;
    if (!isDeleting) i = (i+1) % typedWords.length;
    setTimeout(type, 1000);
  }
}
type();

// Testimonial carousel
let index = 0;
const testimonials = document.querySelectorAll(".testimonial");
function showTestimonial() {
  testimonials.forEach(t => t.classList.remove("active"));
  testimonials[index].classList.add("active");
  index = (index + 1) % testimonials.length;
}
setInterval(showTestimonial, 4000);

  
