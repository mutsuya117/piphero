(() => {
  'use strict';

  const CANVAS_W = 240;
  const CANVAS_H = 320;
  const SYMBOL_SIZE = 16;
  const SYMBOL_SCALE = 4;
  const REEL_COUNT = 3;
  const REEL_VISIBLE_ROWS = 3;
  const SYMBOL_DRAW_SIZE = SYMBOL_SIZE * SYMBOL_SCALE;
  const REEL_TOP = 72;
  const REEL_GAP = 8;
  const REEL_X = [16, 16 + SYMBOL_DRAW_SIZE + REEL_GAP, 16 + (SYMBOL_DRAW_SIZE + REEL_GAP) * 2];
  const CENTER_ROW = 1;
  const SPIN_TIME = 820;
  const STOP_DELAY = 170;
  const WIN_RESULT_TIME = 1800;
  const MISS_RESULT_TIME = 520;
  const PAUSE_TIME = 80;
  const PAYLINES = [
    { name: 'TOP', rows: [0, 0, 0] },
    { name: 'MIDDLE', rows: [1, 1, 1] },
    { name: 'BOTTOM', rows: [2, 2, 2] },
    { name: 'DIAGONAL_DOWN', rows: [0, 1, 2] },
    { name: 'DIAGONAL_UP', rows: [2, 1, 0] },
  ];

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const PALETTE = ['transparent', '#fff', '#f33', '#ff3', '#3f3', '#39f', '#000'];
  const CHAR_TO_COLOR = {
    '.': 0,
    W: 1,
    R: 2,
    Y: 3,
    G: 4,
    B: 5,
    K: 6,
  };

  function sprite(rows) {
    return rows.map((row) => {
      if (row.length !== SYMBOL_SIZE) {
        throw new Error(`Invalid sprite row length: ${row}`);
      }
      return Array.from(row, (char) => CHAR_TO_COLOR[char] ?? 0);
    });
  }

  const SYM_7 = sprite([
    '................',
    '..RRRRRRRRRRRR..',
    '..RWWWWWWWWWWR..',
    '...KKKKKKKRR....',
    '..........RR....',
    '.........RR.....',
    '........RR......',
    '.......RR.......',
    '......RR........',
    '.....RR.........',
    '....RR..........',
    '...RR...........',
    '...RR...........',
    '...RR...........',
    '................',
    '................',
  ]);

  const SYM_BAR = sprite([
    '................',
    '.KKKKKKKKKKKKKK.',
    '.KWWWWWWWWWWWWK.',
    '.K............K.',
    '.KWW...W..WWW.K.',
    '.KW.W.W.W.W..WK.',
    '.KWW..WWW.WWW.K.',
    '.KW.W.W.W.W.W.K.',
    '.KWW..W.W.W..WK.',
    '.K............K.',
    '.KWWWWWWWWWWWWK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
    '................',
    '................',
  ]);

  const SYM_BELL = sprite([
    '................',
    '......YY........',
    '.....YYYY.......',
    '....YYYYYY......',
    '....YYWYYY......',
    '...YYYYYYYY.....',
    '...YYYYYYYY.....',
    '...YYYYYYYY.....',
    '..YYYYYYYYYY....',
    '..YYYYYYYYYY....',
    '..YYYYYYYYYY....',
    '...YYYYYYYY.....',
    '....KKKKKK......',
    '.....KYYK.......',
    '......YY........',
    '................',
  ]);

  const SYM_CHERRY = sprite([
    '................',
    '........GG......',
    '.......GG.......',
    '......GG........',
    '.....GG.GG......',
    '....GG..GG......',
    '...RRR..RRR.....',
    '..RRRW.RRRW.....',
    '..RRRR.RRRR.....',
    '..RRRR.RRRR.....',
    '...RRR..RRR.....',
    '....R....R......',
    '................',
    '................',
    '................',
    '................',
  ]);

  const SYM_WATERMELON = sprite([
    '................',
    '................',
    '....GGGGGGGG....',
    '...GGGGGGGGGG...',
    '..GGKKKKKKKKGG..',
    '..GKRRRRRRRKG...',
    '.GKRRRRRRRRRKG..',
    '.GKRRKRKRKRRKG..',
    '.GKRRRRRRRRRKG..',
    '..GKRRRRRRRKG...',
    '..GGKKKKKKKKGG..',
    '...GGGGGGGGGG...',
    '....GGGGGGGG....',
    '................',
    '................',
    '................',
  ]);

  const SYMBOLS = [SYM_7, SYM_BAR, SYM_BELL, SYM_CHERRY, SYM_WATERMELON];
  const SYMBOL_NAMES = ['7', 'BAR', 'BELL', 'CHERRY', 'WATERMELON'];
  const PAYOUT = { 7: 100, BAR: 50, BELL: 20, CHERRY: 10, WATERMELON: 10 };

  const strips = [
    [0, 2, 4, 1, 3, 2, 0, 4, 3, 1, 2, 4, 0, 3, 1],
    [3, 1, 2, 4, 0, 3, 1, 2, 4, 0, 2, 1, 3, 4, 0],
    [4, 0, 3, 2, 1, 4, 0, 2, 3, 1, 4, 2, 0, 3, 1],
  ];

  const reels = Array.from({ length: REEL_COUNT }, (_, index) => ({
    offsetY: index * 21,
    speed: 8,
    stopping: false,
    stopped: false,
    finalIndex: 0,
    targetOffset: 0,
    strip: strips[index],
  }));

  let coins = 0;
  let phase = 'spinning';
  let phaseTimer = 0;
  let lastTime = performance.now();
  let targetWinSymbol = null;
  let targetWinRows = null;
  let lastResult = null;
  let tapPulse = 0;
  let winBurstSeed = 0;

  function wrapIndex(value, length) {
    return ((value % length) + length) % length;
  }

  function symbolIndexAtRow(reel, row) {
    const base = Math.floor(reel.offsetY / SYMBOL_DRAW_SIZE);
    return reel.strip[wrapIndex(base + row, reel.strip.length)];
  }

  function centerSymbolIndex(reel) {
    return symbolIndexAtRow(reel, CENTER_ROW);
  }

  function centerSymbolName(reel) {
    return SYMBOL_NAMES[centerSymbolIndex(reel)];
  }

  function symbolNameAtRow(reel, row) {
    return SYMBOL_NAMES[symbolIndexAtRow(reel, row)];
  }

  function chooseTargetOffset(reel, reelIndex) {
    const currentTop = Math.floor(reel.offsetY / SYMBOL_DRAW_SIZE);
    const minTravel = 3 + reelIndex * 2 + Math.floor(Math.random() * 2);
    const maxTravel = minTravel + reel.strip.length;

    if (targetWinSymbol !== null && targetWinRows) {
      const targetRow = targetWinRows[reelIndex];
      for (let travel = minTravel; travel <= maxTravel; travel += 1) {
        const topIndex = wrapIndex(currentTop + travel, reel.strip.length);
        const target = reel.strip[wrapIndex(topIndex + targetRow, reel.strip.length)];
        if (target === targetWinSymbol) {
          reel.finalIndex = topIndex;
          return (currentTop + travel) * SYMBOL_DRAW_SIZE;
        }
      }
    }

    const travel = minTravel + Math.floor(Math.random() * reel.strip.length);
    reel.finalIndex = wrapIndex(currentTop + travel, reel.strip.length);
    return (currentTop + travel) * SYMBOL_DRAW_SIZE;
  }

  function beginStopping() {
    phase = 'stopping';
    phaseTimer = 0;
    lastResult = null;
    if (Math.random() < 0.24) {
      targetWinSymbol = Math.floor(Math.random() * SYMBOLS.length);
      targetWinRows = PAYLINES[Math.floor(Math.random() * PAYLINES.length)].rows;
    } else {
      targetWinSymbol = null;
      targetWinRows = null;
    }
  }

  function beginSpin() {
    phase = 'spinning';
    phaseTimer = 0;
    lastResult = null;
    targetWinSymbol = null;
    targetWinRows = null;
    reels.forEach((reel, index) => {
      reel.speed = 8 + index * 0.45;
      reel.stopping = false;
      reel.stopped = false;
      reel.targetOffset = 0;
    });
  }

  function startReelStop(reel, reelIndex) {
    reel.stopping = true;
    reel.speed = Math.max(reel.speed, 10);
    reel.targetOffset = chooseTargetOffset(reel, reelIndex);
  }

  function evaluateResult() {
    const wins = PAYLINES.map((line) => {
      const names = line.rows.map((row, reelIndex) => symbolNameAtRow(reels[reelIndex], row));
      const winner = names.every((name) => name === names[0]);
      return winner ? { line, name: names[0], payout: PAYOUT[names[0]] } : null;
    }).filter(Boolean);
    const payout = wins.reduce((sum, win) => sum + win.payout, 0);
    const winner = wins.length > 0;

    if (payout > 0) {
      coins += payout;
      winBurstSeed += 1;
    }

    lastResult = {
      wins,
      winner,
      payout,
      text: winner ? `WIN x${wins.length} +${payout}` : 'NO WIN',
    };
    phase = 'result';
    phaseTimer = 0;
  }

  function updateReel(reel, dtScale) {
    if (reel.stopped) {
      return;
    }

    if (!reel.stopping) {
      reel.offsetY += reel.speed * dtScale;
      return;
    }

    reel.speed = Math.max(4.4, reel.speed - 0.14 * dtScale);
    const step = reel.speed * dtScale;
    const remaining = reel.targetOffset - reel.offsetY;

    if (remaining <= step) {
      reel.offsetY = reel.targetOffset;
      reel.speed = 0;
      reel.stopping = false;
      reel.stopped = true;
      return;
    }

    reel.offsetY += step;
  }

  function update(dt) {
    const dtScale = dt / (1000 / 60);
    tapPulse = Math.max(0, tapPulse - dt * 0.005);
    phaseTimer += dt;

    if (phase === 'spinning') {
      reels.forEach((reel) => updateReel(reel, dtScale));
      if (phaseTimer >= SPIN_TIME) {
        beginStopping();
      }
      return;
    }

    if (phase === 'stopping') {
      reels.forEach((reel, index) => {
        if (!reel.stopping && !reel.stopped && phaseTimer >= index * STOP_DELAY) {
          startReelStop(reel, index);
        }
        updateReel(reel, dtScale);
      });

      if (reels.every((reel) => reel.stopped)) {
        evaluateResult();
      }
      return;
    }

    if (phase === 'result' && phaseTimer >= (lastResult?.winner ? WIN_RESULT_TIME : MISS_RESULT_TIME)) {
      phase = 'pause';
      phaseTimer = 0;
      return;
    }

    if (phase === 'pause' && phaseTimer >= PAUSE_TIME) {
      beginSpin();
    }
  }

  function fillRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function drawSprite(symbol, x, y) {
    for (let row = 0; row < SYMBOL_SIZE; row += 1) {
      for (let col = 0; col < SYMBOL_SIZE; col += 1) {
        const colorIndex = symbol[row][col];
        if (colorIndex !== 0) {
          fillRect(x + col * SYMBOL_SCALE, y + row * SYMBOL_SCALE, SYMBOL_SCALE, SYMBOL_SCALE, PALETTE[colorIndex]);
        }
      }
    }
  }

  function drawCell(symbolIndex, x, y) {
    fillRect(x, y, SYMBOL_DRAW_SIZE, SYMBOL_DRAW_SIZE, '#101426');
    fillRect(x + 2, y + 2, SYMBOL_DRAW_SIZE - 4, SYMBOL_DRAW_SIZE - 4, '#161d34');
    drawSprite(SYMBOLS[symbolIndex], x, y);
  }

  function drawReel(reel, x) {
    const clipHeight = SYMBOL_DRAW_SIZE * REEL_VISIBLE_ROWS;
    const base = Math.floor(reel.offsetY / SYMBOL_DRAW_SIZE);
    const scroll = reel.offsetY - base * SYMBOL_DRAW_SIZE;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, REEL_TOP, SYMBOL_DRAW_SIZE, clipHeight);
    ctx.clip();

    for (let row = -1; row <= REEL_VISIBLE_ROWS; row += 1) {
      const stripIndex = wrapIndex(base + row, reel.strip.length);
      const symbolIndex = reel.strip[stripIndex];
      const y = REEL_TOP + row * SYMBOL_DRAW_SIZE - scroll;
      drawCell(symbolIndex, x, y);
    }

    ctx.restore();
  }

  function drawText(text, x, y, color, align = 'left') {
    ctx.font = '16px monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function paylinePoint(reelIndex, row) {
    return {
      x: REEL_X[reelIndex] + SYMBOL_DRAW_SIZE / 2,
      y: REEL_TOP + row * SYMBOL_DRAW_SIZE + SYMBOL_DRAW_SIZE / 2,
    };
  }

  function drawPayline(rows, color, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    rows.forEach((row, reelIndex) => {
      const point = paylinePoint(reelIndex, row);
      if (reelIndex === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();

    rows.forEach((row, reelIndex) => {
      const point = paylinePoint(reelIndex, row);
      fillRect(point.x - 3, point.y - 3, 6, 6, color);
    });

    ctx.restore();
  }

  function drawPaylineGuide() {
    PAYLINES.forEach((line) => {
      drawPayline(line.rows, '#39f', 1, 0.22);
    });
  }

  function drawWinningPaylines() {
    if (!lastResult?.winner || (phase !== 'result' && phase !== 'pause')) {
      return;
    }

    lastResult.wins.forEach((win) => {
      drawPayline(win.line.rows, '#000', 7, 0.75);
      drawPayline(win.line.rows, '#ff3', 5, 1);
      drawPayline(win.line.rows, '#fff', 2, 1);
    });
  }

  function drawWinCelebration() {
    if (!lastResult?.winner || (phase !== 'result' && phase !== 'pause')) {
      return;
    }

    const progress = Math.min(1, phaseTimer / WIN_RESULT_TIME);
    const flash = Math.max(0, 1 - progress);
    const pulse = 0.55 + Math.sin(progress * Math.PI * 8) * 0.25;
    const centerX = CANVAS_W / 2;
    const centerY = CANVAS_H / 2;

    ctx.save();
    ctx.globalAlpha = 0.22 * flash + 0.08;
    fillRect(0, 0, CANVAS_W, CANVAS_H, '#ff3');

    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ff3';
    ctx.strokeRect(4, 4, CANVAS_W - 8, CANVAS_H - 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20);

    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18 + winBurstSeed * 0.37;
      const distance = 38 + progress * 98 + (i % 3) * 12;
      const size = 4 + (i % 4) * 2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      fillRect(x - size / 2, y - size / 2, size, size, i % 2 === 0 ? '#fff' : '#ff3');
    }

    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText('JACKPOT!', centerX + 2, 52 + 2);
    ctx.fillStyle = pulse > 0.55 ? '#fff' : '#ff3';
    ctx.fillText('JACKPOT!', centerX, 52);
    ctx.restore();
  }

  function draw() {
    fillRect(0, 0, CANVAS_W, CANVAS_H, '#05070d');
    fillRect(8, 8, CANVAS_W - 16, CANVAS_H - 16, '#0b1020');
    ctx.strokeStyle = '#36436b';
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 9, CANVAS_W - 18, CANVAS_H - 18);

    drawText('PIP SLOT', 16, 18, '#39f');
    drawText(`COINS: ${coins}`, CANVAS_W - 16, 18, '#ff3', 'right');

    fillRect(12, REEL_TOP - 8, CANVAS_W - 24, SYMBOL_DRAW_SIZE * REEL_VISIBLE_ROWS + 16, '#070a12');

    reels.forEach((reel, index) => {
      drawReel(reel, REEL_X[index]);
      ctx.strokeStyle = '#29324e';
      ctx.lineWidth = 2;
      ctx.strokeRect(REEL_X[index], REEL_TOP, SYMBOL_DRAW_SIZE, SYMBOL_DRAW_SIZE * REEL_VISIBLE_ROWS);

      if (index < reels.length - 1) {
        fillRect(REEL_X[index] + SYMBOL_DRAW_SIZE + 3, REEL_TOP - 6, 2, SYMBOL_DRAW_SIZE * REEL_VISIBLE_ROWS + 12, '#36436b');
      }
    });

    drawPaylineGuide();

    if (tapPulse > 0) {
      ctx.strokeStyle = '#fff';
      ctx.globalAlpha = tapPulse;
      ctx.lineWidth = 3;
      ctx.strokeRect(13, REEL_TOP - 7, CANVAS_W - 26, SYMBOL_DRAW_SIZE * REEL_VISIBLE_ROWS + 14);
      ctx.globalAlpha = 1;
    }

    const statusText = lastResult && (phase === 'result' || phase === 'pause') ? lastResult.text : phase.toUpperCase();
    const statusColor = lastResult?.winner && (phase === 'result' || phase === 'pause') ? '#ff3' : '#fff';
    drawText(statusText, CANVAS_W / 2, 282, statusColor, 'center');
    drawWinCelebration();
    drawWinningPaylines();
  }

  function frame(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    tapPulse = 1;
  });

  draw();
  requestAnimationFrame(frame);
})();
