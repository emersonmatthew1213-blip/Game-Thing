// Phaser 3 game: Mullet Kid vs Demogorgon (prototype)
// Controls: A/D move, W or SPACE jump, ENTER shoot (shotgun)
// Author: prototype for emersonmatthew1213-blip/Game-Thing

class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  preload() {
    // We generate simple textures in create() so no external assets are required.
  }

  create() {
    // Basic config
    this.physics.world.setBounds(0, 0, 1600, 900);
    this.cameras.main.setBounds(0, 0, 1600, 900);
    this.cameras.main.setZoom(1.0);

    // Background layers for real world / upside-down toggling
    this.realBg = this.add.rectangle(800, 450, 1600, 900, 0x93d5ff).setDepth(-10);
    this.upsideBg = this.add.rectangle(800, 450, 1600, 900, 0x221a2a).setDepth(-11).setVisible(false);

    // Platforms group
    this.platforms = this.physics.add.staticGroup();
    const ground = this.add.rectangle(800, 880, 1600, 40, 0x654321);
    this.platforms.add(this.physics.add.existing(ground, true).body.gameObject);

    // Some floating platforms
    this.createPlatform(500, 700, 400, 24);
    this.createPlatform(1100, 600, 300, 24);
    this.createPlatform(300, 500, 240, 24);
    this.createPlatform(1400, 420, 300, 24);

    // Create generated textures (player, enemy, bullet, kid celebration)
    this.makePlayerTexture();
    this.makeEnemyTexture();
    this.makeBulletTexture();
    this.makeBowlKidTexture();

    // Player
    this.player = this.physics.add.sprite(200, 760, 'mulletKid').setScale(1).setDepth(1);
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(30, 56, true);
    this.player.speed = 240;
    this.player.jumpSpeed = -480;
    this.player.canShoot = true;
    this.player.shootCooldown = 400; // ms
    this.player.lastShot = 0;

    // Gun group (shotgun pellets)
    this.bullets = this.physics.add.group({
      classType: Phaser.GameObjects.Sprite,
      runChildUpdate: true
    });

    // Demogorgon
    this.demogorgon = this.physics.add.sprite(1200, 760, 'demogorgon').setDepth(1);
    this.demogorgon.setCollideWorldBounds(true);
    this.demogorgon.body.setSize(64, 64, true);
    this.demogorgon.maxHP = 40;
    this.demogorgon.hp = this.demogorgon.maxHP;
    this.demogorgon.state = 'idle'; // idle, charge, jump, dig, reappear, hurt, dead
    this.demogorgon.speed = 160;
    this.demogorgon.phase2 = false;
    this.demogorgon.attackTimer = 0;
    this.demogorgon.attackCooldown = 2000; // will reduce in phase 2
    this.demogorgon.chargeDuration = 800;
    this.demogorgon.isVisible = true;

    // Portal object used when digging
    this.portal = this.add.ellipse(-100, -100, 60, 30, 0x8844ee).setDepth(0).setVisible(false);

    // Collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.demogorgon, this.platforms);
    this.physics.add.collider(this.bullets, this.platforms, (b) => { b.destroy(); });
    this.physics.add.overlap(this.bullets, this.demogorgon, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player, this.demogorgon, this.onPlayerHit, null, this);

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Controls
    this.cursors = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    // HUD text
    this.hud = this.add.text(16, 16, '', { font: '20px monospace', color: '#000' }).setScrollFactor(0).setDepth(10);
    this.updateHUD();

    // Particle manager for hits and fog
    this.hitParticles = this.add.particles('bullet').setDepth(5);

    // Upside-down fog emitter (initially off)
    this.fogParticles = this.add.particles(null);
    this.fogEmitter = this.fogParticles.createEmitter({
      x: { min: 0, max: 1600 }, y: { min: 0, max: 900 },
      speedY: { min: -10, max: -40 },
      alpha: { start: 0.05, end: 0.2 },
      scale: { start: 6, end: 12 },
      blendMode: 'NORMAL',
      quantity: 1,
      frequency: 300
    });
    this.fogEmitter.pause();

    // Vines graphics for phase 2
    this.vinesGroup = this.add.group();

    // Game state
    this.isUpsideDown = false;
    this.victoryTriggered = false;
    this.timeFromStart = 0;
  }

  createPlatform(x, y, w, h) {
    const r = this.add.rectangle(x, y, w, h, 0x333333);
    this.platforms.add(this.physics.add.existing(r, true).body.gameObject);
  }

  makePlayerTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // body
    g.fillStyle(0xffcc66, 1); // jacket
    g.fillRect(6, 16, 20, 28);
    // head
    g.fillStyle(0xffe0c0, 1);
    g.fillRect(8, 0, 16, 16);
    // mullet (80s)
    g.fillStyle(0x222222, 1);
    g.fillRect(6, 0, 22, 6); // fringe
    g.fillRect(18, 6, 10, 18); // mullet back
    g.generateTexture('mulletKid', 32, 48);
    g.destroy();
  }

  makeEnemyTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // demogorgon basic head
    g.fillStyle(0x4b2e2e, 1);
    g.fillCircle(32, 32, 28);
    // mouth petals - simple lines
    g.lineStyle(4, 0xff5555);
    g.beginPath();
    g.moveTo(12, 30);
    g.lineTo(52, 30);
    g.strokePath();
    g.generateTexture('demogorgon', 64, 64);
    g.destroy();
  }

  makeBulletTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xfff1a8, 1);
    g.fillRect(0, 0, 6, 3);
    g.generateTexture('bullet', 6, 3);
    g.destroy();
  }

  makeBowlKidTexture() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // head
    g.fillStyle(0xffe0c0, 1).fillCircle(16, 16, 14);
    // bowl hair
    g.fillStyle(0x111111, 1).fillRect(2, 4, 28, 10);
    g.generateTexture('bowlKid', 32, 32);
    g.destroy();
  }

  update(time, delta) {
    if (this.victoryTriggered) return;
    this.timeFromStart += delta;

    // Player controls
    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const up = this.cursors.up.isDown || this.cursors.space.isDown;
    const enter = Phaser.Input.Keyboard.JustDown(this.cursors.enter);
    const onGround = this.player.body.blocked.down;

    if (left) {
      this.player.setVelocityX(-this.player.speed);
      this.player.flipX = true;
    } else if (right) {
      this.player.setVelocityX(this.player.speed);
      this.player.flipX = false;
    } else {
      this.player.setVelocityX(0);
    }

    if (up && onGround) {
      this.player.setVelocityY(this.player.jumpSpeed);
    }

    if (enter && (time - this.player.lastShot) > this.player.shootCooldown) {
      this.player.lastShot = time;
      this.shootShotgun();
    }

    // Update demogorgon AI
    this.updateDemogorgon(time, delta);

    // Update HUD
    this.updateHUD();
  }

  shootShotgun() {
    // spreads three pellets with slight angle offsets
    const baseX = this.player.x + (this.player.flipX ? -20 : 20);
    const baseY = this.player.y - 6;
    const dir = this.player.flipX ? -1 : 1;
    const angles = [-0.12, 0, 0.12];
    angles.forEach((a) => {
      const vx = Math.cos(a) * 700 * dir;
      const vy = Math.sin(a) * 700;
      const b = this.physics.add.image(baseX, baseY, 'bullet').setDepth(2);
      b.body.allowGravity = false;
      b.setVelocity(vx, vy);
      b.setRotation(a * dir);
      this.bullets.add(b);
      // limit life
      this.time.addEvent({ delay: 900, callback: () => b.destroy() });
    });
  }

  onBulletHitEnemy(bullet, enemy) {
    // avoid multiple collisions
    if (!bullet.active || !enemy.active) return;
    bullet.destroy();

    enemy.hp -= 1;
    // hit particles
    this.hitParticles.createEmitter({
      x: enemy.x, y: enemy.y,
      speed: { min: -100, max: 100 },
      scale: { start: 0.6, end: 0.1 },
      lifespan: 300,
      quantity: 8,
      tint: 0xffaaaa
    }).explode(8, enemy.x, enemy.y);

    // flash
    enemy.setTint(0xff7777);
    this.time.delayedCall(80, () => enemy.clearTint());

    if (enemy.hp <= 0 && enemy.state !== 'dead') {
      this.onDemogorgonDeath();
    } else if (!enemy.phase2 && enemy.hp <= enemy.maxHP / 2) {
      this.enterPhase2();
    }
  }

  onPlayerHit(player, enemy) {
    // simple knockback and respawn style: push player back a bit
    const dir = player.x < enemy.x ? -1 : 1;
    player.setVelocityY(-200);
    player.setVelocityX(-200 * dir);
    // optional: reduce player's "lives" — for prototype we'll just nudge
  }

  updateHUD() {
    const s = `DEMO: ${this.demogorgon.hp}/${this.demogorgon.maxHP}  ${this.isUpsideDown ? 'UPSIDE-DOWN' : 'REAL WORLD'}`;
    this.hud.setText(s);
  }

  updateDemogorgon(time, delta) {
    if (this.demogorgon.state === 'dead') return;

    // simple state machine
    this.demogorgon.attackTimer += delta;
    const playerDistance = Phaser.Math.Distance.Between(this.demogorgon.x, this.demogorgon.y, this.player.x, this.player.y);

    // If digging, reappear logic handled elsewhere
    if (this.demogorgon.state === 'dig') return;

    // If new attack time available, choose an attack weighted by distance
    if (this.demogorgon.attackTimer > this.demogorgon.attackCooldown) {
      this.demogorgon.attackTimer = 0;
      // choose attack
      const r = Math.random();
      if (playerDistance < 220 && r < 0.5) {
        this.startCharge();
      } else if (playerDistance < 350 && r < 0.85) {
        this.startJumpAttack();
      } else {
        this.startDig();
      }
    }

    // If charging, maintain velocity and end after duration
    if (this.demogorgon.state === 'charge') {
      if (!this.demogorgon.chargeStart) this.demogorgon.chargeStart = time;
      if (time - this.demogorgon.chargeStart > this.demogorgon.chargeDuration) {
        this.demogorgon.state = 'idle';
        this.demogorgon.setVelocity(0, 0);
        this.demogorgon.chargeStart = null;
      }
    }
  }

  startCharge() {
    if (this.demogorgon.state === 'dead') return;
    this.demogorgon.state = 'charge';
    const dir = new Phaser.Math.Vector2(this.player.x - this.demogorgon.x, this.player.y - this.demogorgon.y).normalize();
    this.demogorgon.setVelocity(dir.x * (this.demogorgon.speed * 2), dir.y * (this.demogorgon.speed * 0.6));
    this.demogorgon.chargeStart = this.time.now;
    // short roar effect: tint
    this.demogorgon.setTint(0xffaaaa);
    this.time.delayedCall(220, () => this.demogorgon.clearTint());
  }

  startJumpAttack() {
    if (this.demogorgon.state === 'dead') return;
    this.demogorgon.state = 'jump';
    const dirx = Phaser.Math.Clamp(this.player.x - this.demogorgon.x, -1, 1);
    // leap toward player
    this.demogorgon.setVelocityX(dirx * 320);
    this.demogorgon.setVelocityY(-420);
    // after a bit, go back to idle
    this.time.delayedCall(900, () => { if (this.demogorgon.state === 'jump') this.demogorgon.state = 'idle'; });
  }

  startDig() {
    if (this.demogorgon.state === 'dead') return;
    this.demogorgon.state = 'dig';
    // create hole at current position then vanish
    const holeX = this.demogorgon.x; const holeY = this.demogorgon.y + 18;
    const hole = this.add.ellipse(holeX, holeY, 80, 18, 0x000000).setDepth(0.5);
    // vanish
    this.demogorgon.setVisible(false);
    this.demogorgon.body.enable = false;
    // show portal effect and reappear from ceiling after delay
    const delay = 1000 + Phaser.Math.Between(200, 800);
    this.time.delayedCall(delay, () => {
      hole.destroy();
      // choose a ceiling x near the player but above
      const ceilingX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-200, 200), 100, 1500);
      const spawnY = 120; // near ceiling
      // show portal on ceiling
      this.portal.setPosition(ceilingX, spawnY).setVisible(true);
      // small flash
      this.tweens.add({
        targets: this.portal, scaleX: 1.4, scaleY: 1.4, alpha: 1, duration: 200, yoyo: true, onComplete: () => {
          // teleport demogorgon to ceiling and drop
          this.demogorgon.setPosition(ceilingX, spawnY + 28);
          this.demogorgon.setVisible(true);
          this.demogorgon.body.enable = true;
          this.demogorgon.setVelocityY(300); // fall
          this.portal.setVisible(false);
          this.demogorgon.state = 'reappear';
          this.time.delayedCall(400, () => { if (this.demogorgon.state === 'reappear') this.demogorgon.state = 'idle'; });
        }
      });
    });
  }

  enterPhase2() {
    this.demogorgon.phase2 = true;
    this.isUpsideDown = true;
    this.upsideBg.setVisible(true);
    this.realBg.setVisible(false);
    // fog and vines appear
    this.fogEmitter.resume();
    this.createVines();
    // make demogorgon tougher / faster / attack faster
    this.demogorgon.speed *= 1.25;
    this.demogorgon.attackCooldown = Math.max(900, this.demogorgon.attackCooldown * 0.6);
    // brief screen shake
    this.cameras.main.shake(400, 0.01);
    // tint enemy
    this.demogorgon.setTint(0x88ffcc);
  }

  createVines() {
    // draw some vine lines hanging from the top
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(50, 1550);
      const length = Phaser.Math.Between(120, 380);
      const g = this.add.graphics({ x: 0, y: 0, add: true });
      g.lineStyle(6, 0x336633, 0.9);
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x + Phaser.Math.Between(-40, 40), length * 0.5, x + Phaser.Math.Between(-30, 30), length);
      g.strokePath();
      this.vinesGroup.add(g);
    }
  }

  onDemogorgonDeath() {
    this.demogorgon.state = 'dead';
    this.demogorgon.setVelocity(0, 0);
    this.demogorgon.body.enable = false;
    this.demogorgon.setVisible(false);
    this.portal.setVisible(false);
    // confetti / gore particles
    this.add.particles('bullet').createEmitter({
      x: this.demogorgon.x, y: this.demogorgon.y,
      speed: { min: -200, max: 200 }, angle: { min: 0, max: 360 },
      lifespan: 1000, scale: { start: 2.6, end: 0.2 }, quantity: 40
    }).explode(40, this.demogorgon.x, this.demogorgon.y);

    // After a short pause, transition (or if already in upside-down, final victory)
    this.time.delayedCall(800, () => {
      if (!this.isUpsideDown) {
        // move player to portal to go to upside-down (simulate travel)
        this.triggerUpsideDown();
      } else {
        // show bowl-cut kid celebration
        this.spawnBowlKid();
      }
    });
  }

  triggerUpsideDown() {
    // flip to upside-down world where environment is smokey/foggy and vines everywhere
    this.isUpsideDown = true;
    this.upsideBg.setVisible(true);
    this.realBg.setVisible(false);
    this.fogEmitter.resume();
    this.createVines();
    // spawn second phase demogorgon (stronger) at center
    this.demogorgon.hp = this.demogorgon.maxHP + 20; // buff for second phase
    this.demogorgon.maxHP = this.demogorgon.hp;
    this.demogorgon.phase2 = true;
    this.demogorgon.setPosition(1200, 200);
    this.demogorgon.setVisible(true);
    this.demogorgon.body.enable = true;
    this.demogorgon.state = 'idle';
    this.demogorgon.attackCooldown = 1200;
    this.demogorgon.speed *= 1.1;
    // tint to indicate new form
    this.demogorgon.setTint(0x66ffcc);
    // short camera flash
    this.cameras.main.flash(400, 180, 40, 220);
  }

  spawnBowlKid() {
    // spawn bowl-cut kid and a simple celebration
    const kid = this.physics.add.sprite(this.player.x + 40, this.player.y - 20, 'bowlKid').setDepth(10);
    kid.body.allowGravity = false;
    // little bounce/twirl
    this.tweens.add({
      targets: kid,
      y: kid.y - 30,
      angle: 20,
      duration: 500,
      yoyo: true,
      repeat: 6,
      onComplete: () => {
        // final pose: raise arms (scale a bit)
        this.tweens.add({ targets: kid, scale: 1.2, duration: 300 });
      }
    });
    // confetti
    this.add.particles('bullet').createEmitter({
      x: kid.x, y: kid.y, speed: { min: -300, max: 300 }, lifespan: 2000, scale: { start: 3.2, end: 0.2 }, quantity: 60
    }).explode(60, kid.x, kid.y);

    // Freeze gameplay
    this.victoryTriggered = true;
    this.add.text(this.player.x - 140, this.player.y - 200, 'VICTORY!', { font: '48px monospace', color: '#ffffff' }).setDepth(20);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1000,
  height: 600,
  backgroundColor: '#222',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false
    }
  },
  scene: [MainScene]
};

const game = new Phaser.Game(config);
