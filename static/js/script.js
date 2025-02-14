var ans;
var row;
var col;
var guess;
var correct = '#4F7942';
var partial = '#e3b127';
var incorrect = '#2d2e2e';
var map = new Map();
var gameover = false;
var keyboardArr = new Array(26).fill(-1);
var ansDictionary;
var dictionary;
var checkingWord = false;

onStart();
reloadAfterStart();

async function readDict(file){
    try{
        const response = await fetch(file);
        if(!response.ok){
            throw new Error('Failed to fetch ${file}: ${response.status} ${response.statusText}');
        }
        const text = await response.text();
        return text.toUpperCase();
    }catch(error){
        console.log('Error reading dictionary files:', error);
    }
}

async function onStart(){
    const answers = '/dictionary/answers.txt';
    const guesses = '/dictionary/guesses.txt';
    const [answersText, guessesText] = await Promise.all([
        readDict(answers),
        readDict(guesses)
    ]);
    ansDictionary = answersText.split(/\s+/);
    dictionary = new Set([...answersText.split(/\s+/), ...(guessesText.split(/\s+/))]);
}

async function reloadAfterStart(){
    await onStart();
    reload();
}

function reload(){
    let index = Math.floor(Math.random() * 2315);
    ans = ansDictionary[index];
    console.log("Answer is: " + ans);
    guess = "";

    row = 1; col = 1;
    let cells = document.querySelectorAll('.cell');
    let keys = document.querySelectorAll('.key');
    cells.forEach(function(cell){
        cell.style.outlineColor = incorrect;
        cell.style.backgroundColor = '#0f0f0f';
    });
    keys.forEach(function(key){
        key.style.backgroundColor = 'grey';
        key.style.outlineColor = 'grey';
    });
    for(let i = 0; i < 5; ++i){
        if(map.has(ans[i])){
            map.set(ans[i], map.get(ans[i]) + 1);
        }else{
            map.set(ans[i], 1);
        }
    }
}

document.addEventListener('keydown', function(event){
    if((event.key.length == 1 && event.key.match(/[a-z]/i))
      || event.key == 'Backspace' || event.key == 'Enter'){
        updateCell(event.key.toUpperCase());
    }
});

document.querySelectorAll(".key").forEach(function(key){
    key.addEventListener("click", function(){
        updateCell(key.id.toUpperCase());
    });
});

function updateCell(e){
    if(gameover) return;
    if(checkingWord) return;
    if(e.length == 1){
        if(col < 6){
            let cell = document.getElementById(row + '' + col);
            cell.innerHTML = e;
            if(cell.classList.contains('animate-grow-shrink')){
                cell.classList.remove('animate-grow-shrink');
            }
            void cell.offsetWidth;
            cell.classList.add('animate-grow-shrink');
            cell.style.outlineColor = 'grey';
            ++col;
            guess += e;
        }
    }else if(e == "ENTER"){
        if(guess.length == 5) {checkWord();}
    }else{
        if(col > 1){
            --col;
            let cell = document.getElementById(row + '' + col);
            cell.innerHTML = "&nbsp";
            cell.style.outlineColor = incorrect;
            guess = guess.substr(0, col-1);
        }
    }
}

async function checkWord(){
    console.log("Guessed word is: " + guess);
    if(!dictionary.has(guess)){
        alert('Not in word list');
        return;
    }
    checkingWord = true;
    let colorArray = new Array(5).fill(-1);
    let ans_map = new Map(map);
    for(let i = 0; i < 5; ++i){
        if(guess[i] == ans[i]){
            ans_map.set(guess[i], ans_map.get(guess[i]) - 1);
            colorArray[i] = 2;
        }else if(!ans_map.has(guess[i])){
            colorArray[i] = 0;
        }
    }
    for(let i = 0; i < 5; ++i){
        if(colorArray[i] == -1){
            if(ans_map.get(guess[i]) <= 0) {
                colorArray[i] = 0;
            }else{
                ans_map.set(guess[i], ans_map.get(guess[i]) - 1);
                colorArray[i] = 1;
            }
        }
    }
    await updateColors(colorArray);
    checkingWord = false;
    if(guess == ans) {
        let messageArr;
        if(row != 6){
            messageArr = ['Fantastic', 'Awesome', 'Great', 'Fabulous', 'Amazing',
                'Stupendous', 'Brilliant', 'Insane', 'Excellent', 'Nice'
            ]
        }else{
            messageArr = ['Phew.', 'That was close.', 'Clutch.', 'Wow.', 'Insane.',
                'Crazy.', 'OMG.'
            ]
        }
        console.log("You Win!");
        gameover = true;
        return;
    }

    if(row == 6) {
        console.log("Game Over. You lost.");
        gameover = true;
        return;
    }

    row++;
    col = 1;
    guess = "";
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateColors(arr){
    let keyIndex = new Array();
    for(let i = 0; i < 5; ++i){
        let id = row + '' + (i + 1);
        let cell = document.getElementById(id);
        let index = guess[i].charCodeAt(0) - 65;
        if(cell.classList.contains('animate-flip')){
            cell.classList.remove('animate-flip');
        }
        void cell.offsetWidth;
        cell.classList.add('animate-flip');
        await delay(250);
        cell.style.animationPlayState = 'paused';
        if(arr[i] == 2){
            cell.style.backgroundColor = correct;
            cell.style.outlineColor = correct;
            if(keyboardArr[index] != 2){
                keyboardArr[index] = 2;
                keyIndex.push(index);
            }
        }else if(arr[i] == 1){
            cell.style.backgroundColor = partial;
            cell.style.outlineColor = partial;
            if(keyboardArr[index] != 2 && keyboardArr[index] != 1){
                keyboardArr[index] = 1;
                keyIndex.push(index);
            }
        }else{
            cell.style.backgroundColor = incorrect;
            cell.style.outlineColor = incorrect;
            if(keyboardArr[index] == -1){
                keyboardArr[index] = 0;
                keyIndex.push(index);
            }
        }
        cell.style.animationPlayState = 'running';
        await delay(125);
    }
    for(let i = 0; i < keyIndex.length; ++i){
        let id = String.fromCharCode(keyIndex[i] + 65);
        let ind = keyboardArr[keyIndex[i]];
        let key = document.getElementById(id);
        if(ind == 2){
            key.style.backgroundColor = correct;
            key.style.outlineColor = correct;
        }else if(ind == 1){
            key.style.backgroundColor = partial;
            key.style.outlineColor = partial;
        }else{
            key.style.backgroundColor = incorrect;
            key.style.outlineColor = incorrect;
        }
    }
}