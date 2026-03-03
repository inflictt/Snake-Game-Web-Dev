/*
==============================================
  SNAKE GAME — script.js
  
  Flow:
  1. DOM elements pakdo
  2. Game state variables
  3. createGrid()   — board pe cells banao
  4. startTimer()   — 00:00 se count karo
  5. placeFood()    — random food lagao
  6. startGame()    — sab kuch shuru karo
  7. resetGame()    — restart ke liye reset
  8. Game Loop      — setInterval mein snake move + collision
  9. Event Listeners — buttons + keyboard
==============================================
*/


/* ─────────────────────────────────────────
   1. DOM ELEMENTS
   - querySelector = CSS selector se element pakdo
   - getElementById = id se element pakdo
   - Ye sab page load pe ek baar run hoga
   - defer ki wajah se DOM ready hai — null nahi aayega
───────────────────────────────────────── */
const board          = document.querySelector('.board');       // game grid container
const modal          = document.querySelector('.modal');       // overlay div
const startScreen    = document.querySelector('.start-game'); // welcome screen
const gameOverScreen = document.querySelector('.game-over');  // game over screen
const btnStart       = document.querySelector('.btn-start');  // start button
const btnRestart     = document.querySelector('.btn-restart');// restart button
const scoreEl        = document.getElementById('score');      // score display
const highscoreEl    = document.getElementById('high-score'); // high score display
const timeEl         = document.getElementById('time');       // timer display


/* ─────────────────────────────────────────
   2. GAME STATE VARIABLES

   SCORE:
   - score = current game ka score
   - highscore = localStorage se milega (0 agar pehli baar)
     Number() — localStorage string deta hai, number chahiye
     || 0     — agar localStorage mein kuch nahi toh 0

   TIMER:
   - timerInterval = setInterval ka ID (band karne ke liye)
   - seconds = total seconds chale hain

   GRID:
   - blockWidth/Height = har cell ka size pixels mein

   GAME:
   - intervalId = game loop ka setInterval ID
   - snake = array of positions [{x,y}, {x,y}...]
             x = row number (0 se top)
             y = col number (0 se left)
             snake[0] = HEAD
   - direction = current direction
   - nextDirection = buffer — keypress store karta hai
                     direct direction nahi badlo, warna
                     same tick mein 180° turn possible tha
   - food = {x, y} food ki position
   - blocks = {} — "row-col" → DOM element map
                   e.g. blocks["3-5"] = <div class="block">
───────────────────────────────────────── */
let score        = 0;
let highscore    = Number(localStorage.getItem("highscore")) || 0;

let timerInterval = null;
let seconds       = 0;

const blockWidth  = 40; // har cell 40px wide
const blockHeight = 40; // har cell 40px tall

let intervalId    = null;
let snake         = [{ x: 1, y: 3 }]; // ek cell se shuru
let direction     = "right";
let nextDirection = "right"; // direction buffer
let food          = { x: 2, y: 2 };
let blocks        = {};

// Page load pe localStorage ka highscore dikhao
highscoreEl.textContent = highscore;


/* ─────────────────────────────────────────
   3. createGrid() — Board pe Grid Cells Banao

   PROBLEM jo solve karta hai:
   board.clientWidth = 1300px (flex se mili)
   blockWidth = 40px
   1300 / 40 = 32.5 → Math.floor = 32 cols
   32 * 40 = 1280px ← board ko yahan snap karo
   Remaining 20px → overflow:hidden chhupaega

   BLOCKS OBJECT:
   blocks["0-0"] = <div>  (row 0, col 0)
   blocks["0-1"] = <div>  (row 0, col 1)
   blocks["3-5"] = <div>  (row 3, col 5)
   Is tarah kisi bhi position pe seedha element milta hai
───────────────────────────────────────── */
function createGrid() {
    board.innerHTML = ''; // purani cells saaf karo (restart ke liye)
    blocks = {};          // blocks map bhi reset karo

    // Board ki current available size lo
    // clientWidth/Height = actual rendered size (padding included)
    const cols = Math.floor(board.clientWidth  / blockWidth);
    const rows = Math.floor(board.clientHeight / blockHeight);

    // Board ko exact snap karo — koi gap nahi bachega
    // (remainder pixels overflow:hidden handle karega)
    board.style.width  = `${cols * blockWidth}px`;
    board.style.height = `${rows * blockHeight}px`;

    // CSS Grid columns aur rows define karo
    // repeat(32, 40px) = 32 columns, har ek 40px
    board.style.gridTemplateColumns = `repeat(${cols}, ${blockWidth}px)`;
    board.style.gridTemplateRows    = `repeat(${rows}, ${blockHeight}px)`;

    // Har row aur col ke liye ek cell banao
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const block = document.createElement('div');
            block.classList.add("block");
            board.appendChild(block);

            // blocks map mein store karo — "row-col" key
            blocks[`${r}-${c}`] = block;
        }
    }

    return { rows, cols }; // startGame ko chahiye ye values
}


/* ─────────────────────────────────────────
   4. startTimer() — Game Timer

   - seconds reset karo
   - har 1000ms (1 second) pe seconds++
   - MM:SS format mein dikhao

   padStart(2, '0') kya karta hai:
   String(5)  → "5"  → padStart(2,'0') → "05"
   String(12) → "12" → padStart(2,'0') → "12" (already 2 chars)

   % operator (modulo):
   65 seconds:
   mins = Math.floor(65/60) = 1
   secs = 65 % 60 = 5
   → "01:05"
───────────────────────────────────────── */
function startTimer() {
    seconds = 0; // reset karo

    timerInterval = setInterval(() => {
        seconds++;

        const mins = Math.floor(seconds / 60); // poore minutes
        const secs = seconds % 60;             // baache seconds

        // "01:05" format — padStart se leading zero
        timeEl.textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000); // har 1 second pe
}


/* ─────────────────────────────────────────
   5. placeFood() — Random Food Lagao

   - Pehle purana food hatao (agar hai)
   - Random row aur col choose karo
   - Us block pe 'food' class lagao (CSS se circle bnega)

   ?. (optional chaining):
   blocks[`${food.x}-${food.y}`]?.classList
   Agar block exist nahi karta → error nahi aayega
   (edge case: food boundary pe tha)
───────────────────────────────────────── */
function placeFood(rows, cols) {
    // Purana food hata do
    blocks[`${food.x}-${food.y}`]?.classList.remove('food');

    // Naya random position
    food = {
        x: Math.floor(Math.random() * rows), // random row
        y: Math.floor(Math.random() * cols)  // random col
    };

    // Food dikhao
    blocks[`${food.x}-${food.y}`]?.classList.add('food');
}


/* ─────────────────────────────────────────
   6. startGame() — Game Shuru Karo

   ORDER IMPORTANT HAI:
   1. Pehle purane intervals band karo
   2. Grid banao
   3. Food lagao
   4. Timer shuru karo
   5. Game loop shuru karo

   Agar order galat ho:
   startTimer() pehle → clearInterval turant baad
   = timer ek baar bhi nahi chalega!
───────────────────────────────────────── */
function startGame() {
    // Modal chhupaao (start/gameover screen hatao)
    modal.classList.add('hidden');

    // STEP 1: Purane intervals band karo
    // (restart pe double interval nahi chalega)
    if (intervalId)    clearInterval(intervalId);
    if (timerInterval) clearInterval(timerInterval);

    // STEP 2: Grid banao
    const { rows, cols } = createGrid();

    // STEP 3: Food lagao
    placeFood(rows, cols);

    // STEP 4: Timer shuru karo
    startTimer();

    // STEP 5: Game Loop — har 200ms pe chalta hai
    intervalId = setInterval(() => {

        // ── Direction Buffer Apply Karo ──────────
        // nextDirection = jo key press hua tha
        // direction = actual current direction
        // Dono alag isliye: same tick mein 2 keys press
        // karke 180° turn possible tha (instant death bug)
        direction = nextDirection;

        // ── Naya Head Calculate Karo ─────────────
        // Spread operator {...snake[0]} = copy banao
        // Same object modify nahi karte (reference problem avoid)
        let head = { ...snake[0] };

        // Direction ke hisaab se move karo
        // x = row: upar jaana = row kam karo (x--)
        //          neeche jaana = row badhao (x++)
        // y = col: left  jaana = col kam karo (y--)
        //          right jaana = col badhao (y++)
        if      (direction === "right") head.y += 1;
        else if (direction === "left")  head.y -= 1;
        else if (direction === "up")    head.x -= 1;
        else if (direction === "down")  head.x += 1;

        const newKey = `${head.x}-${head.y}`;

        // ── Collision Check ───────────────────────
        // 2 cases mein game over:

        // Case 1: Wall — blocks mein key nahi mili
        // blocks["5-33"] = undefined (grid 32 cols hai)
        // !undefined = true → game over

        // Case 2: Body — snake ke kisi part se match
        // .some() = array mein koi bhi element condition
        //           satisfy kare toh true return karo
        // Jaise hi match mile → ruk jaata hai (efficient)
        if (!blocks[newKey] ||
            snake.some(s => s.x === head.x && s.y === head.y)) {

            clearInterval(intervalId);    // game loop band
            clearInterval(timerInterval); // timer band

            // Game Over screen dikhao
            gameOverScreen.classList.remove('hidden');
            modal.classList.remove('hidden');
            startScreen.classList.add('hidden');
            return; // setInterval ka ye execution yahan rok do
        }

        // ── Snake Move Karo ───────────────────────
        snake.unshift(head); // naya head front mein add karo

        if (head.x === food.x && head.y === food.y) {
            // Food khaya!
            // Tail mat hatao → snake ek cell badi ho jaayegi

            // Score badhao
            score++;
            scoreEl.textContent = score;

            // High Score check karo
            if (score > highscore) {
                highscore = score;
                localStorage.setItem("highscore", highscore); // browser mein save
                highscoreEl.textContent = highscore;
            }

            // Naya food lagao
            placeFood(rows, cols);

        } else {
            // Food nahi khaya
            // Tail hatao → same length rehti hai snake
            const tail = snake.pop();
            blocks[`${tail.x}-${tail.y}`].classList.remove('fill');
        }

        // Snake ke saare parts pe fill class lagao
        snake.forEach(s => blocks[`${s.x}-${s.y}`].classList.add('fill'));

    }, 200); // har 200ms = snake ki speed
}


/* ─────────────────────────────────────────
   7. resetGame() — Restart ke liye Sab Reset Karo

   location.reload() se poora page reload hota tha
   Ye properly reset karta hai bina page reload ke:
   - Snake wapas starting position
   - Score 0
   - Timer 00:00
   - Screens sahi karo
   - Phir startGame() call karo
───────────────────────────────────────── */
function resetGame() {
    // Snake aur direction reset
    snake         = [{ x: 1, y: 3 }];
    direction     = "right";
    nextDirection = "right";

    // Score reset (highscore reset NAHI hoga — localStorage mein hai)
    score = 0;
    scoreEl.textContent = 0;
    timeEl.textContent  = "00:00";

    // Modal screens reset karo
    // Game over chhupaao, start screen wapas dikhao
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');

    // startGame call karo — ye modal bhi chhupaayega
    startGame();
}


/* ─────────────────────────────────────────
   8. EVENT LISTENERS

   BUTTONS:
   - btnStart   → startGame()
   - btnRestart → resetGame()

   KEYBOARD:
   - Arrow keys se nextDirection update karo
   - DIRECT direction mat badlo (buffer use karo)
   - Opposite direction block karo:
     Right chal raha hai → Left press nahi kar sakte
     (180° turn = instant self-collision)

   nextDirection kyun?
   Problem:  setInterval 200ms pe chalta hai
             User bahut fast 2 keys press kare:
             Right → Up → Down (same tick mein)
             Direction = Down, previous = Right
             Check fails → collision!
   Solution: nextDirection buffer mein store karo
             Sirf setInterval ke ANDAR apply karo
             Isse ek tick mein sirf ek direction change hoga
───────────────────────────────────────── */
btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', resetGame);

window.addEventListener("keydown", (e) => {
    // Opposite direction block karo
    if      (e.key === "ArrowUp"    && direction !== "down")  nextDirection = "up";
    else if (e.key === "ArrowDown"  && direction !== "up")    nextDirection = "down";
    else if (e.key === "ArrowRight" && direction !== "left")  nextDirection = "right";
    else if (e.key === "ArrowLeft"  && direction !== "right") nextDirection = "left";
});