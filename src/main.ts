// Tank Battle Game - 坦克大战
// TypeScript + HTML5 Canvas

const CANVAS_WIDTH = 832;
const CANVAS_HEIGHT = 640;
const TILE_SIZE = 32;
const COLS = 26;
const ROWS = 20;

type Direction = 'up' | 'down' | 'left' | 'right';
type GameState = 'start' | 'playing' | 'gameover' | 'victory';

interface Point {
  x: number;
  y: number;
}

interface Tank {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: Direction;
  speed: number;
  cooldown: number;
  isPlayer: boolean;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  alive: boolean;
  isPlayer: boolean;
}

interface Tile {
  type: 'empty' | 'brick' | 'steel' | 'river' | 'ice';
  x: number;
  y: number;
}

class TankBattle {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player: Tank;
  private enemies: Tank[];
  private bullets: Bullet[];
  private tiles: Tile[][];
  private gameState: GameState;
  private score: number;
  private lives: number;
  private enemySpawnTimer: number;
  private enemySpawnInterval: number;
  private keys: Set<string>;
  private lastTime: number;
  private enemyDirectionTimers: Map<Tank, number>;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    
    this.player = this.createPlayerTank();
    this.enemies = [];
    this.bullets = [];
    this.tiles = [];
    this.gameState = 'start';
    this.score = 0;
    this.lives = 3;
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 180;
    this.keys = new Set();
    this.lastTime = 0;
    this.enemyDirectionTimers = new Map();
    
    this.initTiles();
    this.setupControls();
    this.gameLoop = this.gameLoop.bind(this);
    requestAnimationFrame(this.gameLoop);
  }

  private createPlayerTank(): Tank {
    return {
      x: CANVAS_WIDTH / 2 - TILE_SIZE,
      y: CANVAS_HEIGHT - TILE_SIZE * 2,
      width: TILE_SIZE,
      height: TILE_SIZE,
      direction: 'up',
      speed: 3,
      cooldown: 0,
      isPlayer: true,
      alive: true
    };
  }

  private initTiles(): void {
    // Initialize empty map
    for (let row = 0; row < ROWS; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < COLS; col++) {
        this.tiles[row][col] = { type: 'empty', x: col * TILE_SIZE, y: row * TILE_SIZE };
      }
    }

    // Create border walls
    for (let col = 0; col < COLS; col++) {
      this.setTile(col, 0, 'steel');
      this.setTile(col, ROWS - 1, 'steel');
    }
    for (let row = 0; row < ROWS; row++) {
      this.setTile(0, row, 'steel');
      this.setTile(COLS - 1, row, 'steel');
    }

    // Create inner brick walls - classic Battle City layout
    const brickLayouts = [
      // Top area
      [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
      [18, 3], [19, 3], [20, 3], [21, 3], [22, 3],
      [10, 3], [15, 3],
      [12, 4], [13, 4],
      
      // Middle area
      [3, 6], [4, 6], [5, 6],
      [20, 6], [21, 6], [22, 6],
      [10, 6], [15, 6],
      [12, 7], [13, 7],
      
      // Center fortress
      [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9],
      [10, 10], [15, 10],
      [10, 11], [15, 11],
      [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [15, 12],
      
      // Bottom area
      [3, 14], [4, 14], [5, 14],
      [20, 14], [21, 14], [22, 14],
      [10, 16], [15, 16],
      [3, 17], [4, 17], [5, 17],
      [20, 17], [21, 17], [22, 17],
    ];

    for (const [col, row] of brickLayouts) {
      this.setTile(col, row, 'brick');
    }

    // Add steel fortifications
    const steelLayouts = [
      [12, 2], [13, 2],
      [6, 6], [19, 6],
      [0, 9], [25, 9],
      [6, 14], [19, 14],
      [12, 17], [13, 17],
    ];

    for (const [col, row] of steelLayouts) {
      this.setTile(col, row, 'steel');
    }

    // Add rivers
    const riverLayouts = [
      [7, 5], [8, 5],
      [7, 6], [8, 6],
      [17, 5], [18, 5],
      [17, 6], [18, 6],
      [7, 13], [8, 13],
      [17, 13], [18, 13],
    ];

    for (const [col, row] of riverLayouts) {
      this.setTile(col, row, 'river');
    }
  }

  private setTile(col: number, row: number, type: Tile['type']): void {
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      this.tiles[row][col] = { type, x: col * TILE_SIZE, y: row * TILE_SIZE };
    }
  }

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      if (this.gameState === 'start' && (e.key === ' ' || e.key === 'Enter')) {
        this.startGame();
      }
      
      if (this.gameState === 'gameover' && (e.key === ' ' || e.key === 'Enter')) {
        this.restartGame();
      }
      
      if (this.gameState === 'victory' && (e.key === ' ' || e.key === 'Enter')) {
        this.restartGame();
      }
      
      if (e.key === ' ') {
        e.preventDefault();
        this.playerShoot();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  private startGame(): void {
    this.gameState = 'playing';
    this.score = 0;
    this.lives = 3;
    this.player = this.createPlayerTank();
    this.enemies = [];
    this.bullets = [];
    this.enemySpawnTimer = 0;
    this.initTiles();
  }

  private restartGame(): void {
    this.startGame();
  }

  private playerShoot(): void {
    if (this.gameState !== 'playing' || !this.player.alive || this.player.cooldown > 0) return;
    
    const bullet = this.createBullet(this.player);
    this.bullets.push(bullet);
    this.player.cooldown = 15;
  }

  private enemyShoot(enemy: Tank): void {
    if (enemy.cooldown > 0) return;
    
    const bullet = this.createBullet(enemy);
    this.bullets.push(bullet);
    enemy.cooldown = 60 + Math.random() * 60;
  }

  private createBullet(tank: Tank): Bullet {
    let x = tank.x + tank.width / 2 - 4;
    let y = tank.y + tank.height / 2 - 4;
    
    switch (tank.direction) {
      case 'up': y -= tank.height / 2; break;
      case 'down': y += tank.height / 2; break;
      case 'left': x -= tank.width / 2; break;
      case 'right': x += tank.width / 2; break;
    }
    
    return {
      x,
      y,
      direction: tank.direction,
      speed: 5,
      alive: true,
      isPlayer: tank.isPlayer
    };
  }

  private spawnEnemy(): void {
    if (this.enemies.length >= 5) return;
    
    const spawnPoints = [
      { x: TILE_SIZE * 2, y: TILE_SIZE * 2 },
      { x: CANVAS_WIDTH / 2 - TILE_SIZE, y: TILE_SIZE * 2 },
      { x: CANVAS_WIDTH - TILE_SIZE * 3, y: TILE_SIZE * 2 },
    ];
    
    const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    
    const enemy: Tank = {
      x: spawn.x,
      y: spawn.y,
      width: TILE_SIZE,
      height: TILE_SIZE,
      direction: 'down',
      speed: 1.5,
      cooldown: 0,
      isPlayer: false,
      alive: true
    };
    
    this.enemies.push(enemy);
    this.enemyDirectionTimers.set(enemy, 0);
  }

  private movePlayer(): void {
    if (!this.player.alive || this.gameState !== 'playing') return;

    let newX = this.player.x;
    let newY = this.player.y;

    if (this.keys.has('w') || this.keys.has('arrowup')) {
      this.player.direction = 'up';
      newY -= this.player.speed;
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      this.player.direction = 'down';
      newY += this.player.speed;
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      this.player.direction = 'left';
      newX -= this.player.speed;
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      this.player.direction = 'right';
      newX += this.player.speed;
    }

    if (!this.checkCollision(newX, newY, this.player.width, this.player.height)) {
      this.player.x = newX;
      this.player.y = newY;
    }

    // Keep player in bounds
    this.player.x = Math.max(0, Math.min(CANVAS_WIDTH - this.player.width, this.player.x));
    this.player.y = Math.max(0, Math.min(CANVAS_HEIGHT - this.player.height, this.player.y));

    if (this.player.cooldown > 0) this.player.cooldown--;
  }

  private moveEnemies(): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      // Update direction timer
      const timer = this.enemyDirectionTimers.get(enemy) || 0;
      const newTimer = timer + 1;
      this.enemyDirectionTimers.set(enemy, newTimer);

      // Change direction periodically or when blocked
      if (newTimer > 60 || this.checkCollision(enemy.x, enemy.y, enemy.width, enemy.height)) {
        const directions: Direction[] = ['up', 'down', 'left', 'right'];
        enemy.direction = directions[Math.floor(Math.random() * directions.length)];
        this.enemyDirectionTimers.set(enemy, 0);
      }

      let newX = enemy.x;
      let newY = enemy.y;

      switch (enemy.direction) {
        case 'up': newY -= enemy.speed; break;
        case 'down': newY += enemy.speed; break;
        case 'left': newX -= enemy.speed; break;
        case 'right': newX += enemy.speed; break;
      }

      if (!this.checkCollision(newX, newY, enemy.width, enemy.height)) {
        enemy.x = newX;
        enemy.y = newY;
      } else {
        enemy.direction = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)] as Direction;
        this.enemyDirectionTimers.set(enemy, 0);
      }

      // Keep enemy in bounds
      enemy.x = Math.max(0, Math.min(CANVAS_WIDTH - enemy.width, enemy.x));
      enemy.y = Math.max(0, Math.min(CANVAS_HEIGHT - enemy.height, enemy.y));

      // Enemy shoots
      if (Math.random() < 0.02) {
        this.enemyShoot(enemy);
      }

      if (enemy.cooldown > 0) enemy.cooldown--;
    }
  }

  private moveBullets(): void {
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;

      switch (bullet.direction) {
        case 'up': bullet.y -= bullet.speed; break;
        case 'down': bullet.y += bullet.speed; break;
        case 'left': bullet.x -= bullet.speed; break;
        case 'right': bullet.x += bullet.speed; break;
      }

      // Check bounds
      if (bullet.x < 0 || bullet.x > CANVAS_WIDTH || bullet.y < 0 || bullet.y > CANVAS_HEIGHT) {
        bullet.alive = false;
        continue;
      }

      // Check tile collision
      const col = Math.floor(bullet.x / TILE_SIZE);
      const row = Math.floor(bullet.y / TILE_SIZE);
      
      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        const tile = this.tiles[row][col];
        if (tile.type === 'brick') {
          bullet.alive = false;
          this.setTile(col, row, 'empty');
        } else if (tile.type === 'steel') {
          bullet.alive = false;
        }
      }

      // Check tank collision
      if (bullet.isPlayer) {
        for (const enemy of this.enemies) {
          if (enemy.alive && this.checkBulletTankCollision(bullet, enemy)) {
            bullet.alive = false;
            enemy.alive = false;
            this.score += 100;
            break;
          }
        }
      } else {
        if (this.player.alive && this.checkBulletTankCollision(bullet, this.player)) {
          bullet.alive = false;
          this.player.alive = false;
          this.lives--;
          
          if (this.lives <= 0) {
            this.gameState = 'gameover';
          } else {
            setTimeout(() => {
              this.player = this.createPlayerTank();
            }, 1000);
          }
        }
      }
    }

    // Remove dead bullets
    this.bullets = this.bullets.filter(b => b.alive);
  }

  private checkBulletTankCollision(bullet: Bullet, tank: Tank): boolean {
    return bullet.x < tank.x + tank.width &&
           bullet.x + 8 > tank.x &&
           bullet.y < tank.y + tank.height &&
           bullet.y + 8 > tank.y;
  }

  private checkCollision(x: number, y: number, width: number, height: number): boolean {
    // Check tile collisions (not river or ice)
    const left = Math.floor(x / TILE_SIZE);
    const right = Math.floor((x + width - 1) / TILE_SIZE);
    const top = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + height - 1) / TILE_SIZE);

    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          const tile = this.tiles[row][col];
          if (tile.type === 'brick' || tile.type === 'steel') {
            return true;
          }
        }
      }
    }

    return false;
  }

  private update(_deltaTime: number): void {
    if (this.gameState !== 'playing') return;

    this.movePlayer();
    this.moveEnemies();
    this.moveBullets();

    // Spawn enemies
    this.enemySpawnTimer++;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
    }

    // Remove dead enemies
    this.enemies = this.enemies.filter(e => e.alive);

    // Check victory
    if (this.enemies.length >= 10 && this.enemies.filter(e => e.alive).length === 0) {
      this.gameState = 'victory';
    }
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.gameState === 'start') {
      this.renderStartScreen();
      return;
    }

    // Render tiles
    this.renderTiles();

    // Render tanks
    this.renderTank(this.player);
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        this.renderTank(enemy);
      }
    }

    // Render bullets
    this.renderBullets();

    // Render HUD
    this.renderHUD();

    // Render game over or victory
    if (this.gameState === 'gameover') {
      this.renderGameOver();
    } else if (this.gameState === 'victory') {
      this.renderVictory();
    }
  }

  private renderTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = this.tiles[row][col];
        
        switch (tile.type) {
          case 'brick':
            this.ctx.fillStyle = '#c84c0c';
            this.ctx.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = '#a33d08';
            this.ctx.strokeRect(tile.x + 1, tile.y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            // Brick pattern
            this.ctx.beginPath();
            this.ctx.moveTo(tile.x, tile.y + TILE_SIZE / 2);
            this.ctx.lineTo(tile.x + TILE_SIZE, tile.y + TILE_SIZE / 2);
            this.ctx.moveTo(tile.x + TILE_SIZE / 2, tile.y);
            this.ctx.lineTo(tile.x + TILE_SIZE / 2, tile.y + TILE_SIZE / 2);
            this.ctx.moveTo(tile.x + TILE_SIZE / 4, tile.y + TILE_SIZE / 2);
            this.ctx.lineTo(tile.x + TILE_SIZE / 4, tile.y + TILE_SIZE);
            this.ctx.moveTo(tile.x + TILE_SIZE * 3 / 4, tile.y + TILE_SIZE / 2);
            this.ctx.lineTo(tile.x + TILE_SIZE * 3 / 4, tile.y + TILE_SIZE);
            this.ctx.strokeStyle = '#a33d08';
            this.ctx.stroke();
            break;
            
          case 'steel':
            this.ctx.fillStyle = '#0099cc';
            this.ctx.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = '#006699';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(tile.x + 2, tile.y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            this.ctx.beginPath();
            this.ctx.moveTo(tile.x + 8, tile.y + 8);
            this.ctx.lineTo(tile.x + TILE_SIZE - 8, tile.y + TILE_SIZE - 8);
            this.ctx.moveTo(tile.x + TILE_SIZE - 8, tile.y + 8);
            this.ctx.lineTo(tile.x + 8, tile.y + TILE_SIZE - 8);
            this.ctx.strokeStyle = '#006699';
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
            break;
            
          case 'river':
            this.ctx.fillStyle = '#000080';
            this.ctx.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
            this.ctx.fillStyle = '#0000cc';
            this.ctx.fillRect(tile.x + 4, tile.y + 8, 8, 4);
            this.ctx.fillRect(tile.x + 20, tile.y + 16, 8, 4);
            break;
            
          case 'ice':
            this.ctx.fillStyle = '#99ccff';
            this.ctx.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
            break;
        }
      }
    }
  }

  private renderTank(tank: Tank): void {
    const cx = tank.x + tank.width / 2;
    const cy = tank.y + tank.height / 2;
    
    // Tank body color
    this.ctx.fillStyle = tank.isPlayer ? '#4a8f4a' : '#8b0000';
    
    this.ctx.save();
    this.ctx.translate(cx, cy);
    
    // Rotate based on direction
    switch (tank.direction) {
      case 'up': this.ctx.rotate(0); break;
      case 'down': this.ctx.rotate(Math.PI); break;
      case 'left': this.ctx.rotate(-Math.PI / 2); break;
      case 'right': this.ctx.rotate(Math.PI / 2); break;
    }
    
    // Tank body
    this.ctx.fillRect(-12, -10, 24, 20);
    
    // Tank tracks
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(-14, -12, 4, 24);
    this.ctx.fillRect(10, -12, 4, 24);
    
    // Tank turret
    this.ctx.fillStyle = tank.isPlayer ? '#3a7a3a' : '#6b0000';
    this.ctx.fillRect(-6, -6, 12, 12);
    
    // Tank barrel
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(-2, -18, 4, 10);
    
    // Tank dome
    this.ctx.fillStyle = tank.isPlayer ? '#2a5f2a' : '#4a0000';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  private renderBullets(): void {
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      
      this.ctx.fillStyle = bullet.isPlayer ? '#ffff00' : '#ff0000';
      
      // Draw bullet with direction
      this.ctx.save();
      this.ctx.translate(bullet.x + 4, bullet.y + 4);
      
      switch (bullet.direction) {
        case 'up': this.ctx.rotate(0); break;
        case 'down': this.ctx.rotate(Math.PI); break;
        case 'left': this.ctx.rotate(-Math.PI / 2); break;
        case 'right': this.ctx.rotate(Math.PI / 2); break;
      }
      
      this.ctx.fillRect(-3, -5, 6, 10);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(-1, -3, 2, 6);
      
      this.ctx.restore();
    }
  }

  private renderHUD(): void {
    // Background
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
    
    // Border
    this.ctx.strokeStyle = '#fff';
    this.ctx.strokeRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
    
    // Score
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`SCORE: ${this.score}`, 10, CANVAS_HEIGHT - 10);
    
    // Lives
    this.ctx.fillText(`LIVES: ${this.lives}`, CANVAS_WIDTH / 2 - 40, CANVAS_HEIGHT - 10);
    
    // Enemies remaining
    const remaining = Math.max(0, 10 - this.enemies.length);
    this.ctx.fillText(`ENEMIES: ${remaining}`, CANVAS_WIDTH - 120, CANVAS_HEIGHT - 10);
  }

  private renderStartScreen(): void {
    // Title background
    this.ctx.fillStyle = '#001100';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Title
    this.ctx.fillStyle = '#ff6600';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('TANK BATTLE', CANVAS_WIDTH / 2, 200);
    
    this.ctx.fillStyle = '#ffcc00';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.fillText('坦克大战', CANVAS_WIDTH / 2, 250);
    
    // Tank icon
    this.ctx.save();
    this.ctx.translate(CANVAS_WIDTH / 2, 350);
    this.ctx.fillStyle = '#4a8f4a';
    this.ctx.fillRect(-20, -15, 40, 30);
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(-24, -18, 6, 36);
    this.ctx.fillRect(18, -18, 6, 36);
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(-3, -30, 6, 18);
    this.ctx.restore();
    
    // Instructions
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px Arial';
    this.ctx.fillText('CONTROLS:', CANVAS_WIDTH / 2, 420);
    
    this.ctx.font = '16px Arial';
    this.ctx.fillText('WASD / Arrow Keys - Move Tank', CANVAS_WIDTH / 2, 450);
    this.ctx.fillText('SPACE - Shoot', CANVAS_WIDTH / 2, 475);
    
    // Start prompt
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 24px Arial';
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      this.ctx.fillText('Press SPACE or ENTER to Start', CANVAS_WIDTH / 2, 540);
    }
    
    this.ctx.textAlign = 'left';
  }

  private renderGameOver(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    this.ctx.fillStyle = '#ff0000';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Final Score: ${this.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '20px Arial';
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      this.ctx.fillText('Press SPACE to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    }
    
    this.ctx.textAlign = 'left';
  }

  private renderVictory(): void {
    this.ctx.fillStyle = 'rgba(0, 50, 0, 0.8)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    this.ctx.fillStyle = '#ffcc00';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VICTORY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Final Score: ${this.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '20px Arial';
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      this.ctx.fillText('Press SPACE to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    }
    
    this.ctx.textAlign = 'left';
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.gameLoop);
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TankBattle();
});
