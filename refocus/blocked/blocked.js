const overrideBtn = document.getElementById("overrideBtn");
const challengeDiv = document.getElementById("challenge");
const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answer");
const submitBtn = document.getElementById("submitAnswer");
const quoteEl = document.getElementById("quote");


let correctAnswer = null;
let currentHost = null;

// Get the blocked site from URL
const params = new URLSearchParams(window.location.search);
currentHost = params.get("domain");


function generateQuestion() {
  const a = Math.floor(Math.random() * 50);
  const b = Math.floor(Math.random() * 50);
  correctAnswer = a + b;

  questionEl.textContent = `What is ${a} + ${b}?`;
}


overrideBtn.addEventListener("click", () => {
  challengeDiv.style.display = "block";
  generateQuestion();
});


submitBtn.addEventListener("click", () => {
  const userAnswer = parseInt(answerInput.value, 10);

  if (userAnswer === correctAnswer) {
    chrome.runtime.sendMessage({
      type: "TEMP_ALLOW",
      domain: currentHost,
      duration: 5 * 60 * 1000
    });

    alert("Access granted for 5 minutes!");

    // Go back to the site
    window.location.href = "https://" + currentHost;
  } else {
    alert("Wrong answer. Try again.");
    generateQuestion();
  }
});

const quotes = [
  "Small steps still move you forward.",
  "Focus now, relax later.",
  "You are doing better than you think.",
  "Discipline builds freedom.",
  "One task at a time.",
  "Progress, not perfection.",
  "Stay present. Stay steady.",
  "This moment matters."
];

const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
quoteEl.textContent = randomQuote;

