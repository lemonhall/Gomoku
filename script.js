import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 游戏配置
const BOARD_SIZE = 15;
const CELL_SIZE = 2; // 每个格子的物理尺寸
const BOARD_WIDTH = (BOARD_SIZE - 1) * CELL_SIZE;
const PIECE_RADIUS = CELL_SIZE * 0.4;

// 游戏状态
let board = []; // 15x15 数组
let currentPlayer = 1; // 1: 黑棋, 2: 白棋
let isGameOver = false;
let pieces = []; // 存储棋子Mesh以便清理
let gameMode = 'pve'; // 'pve' or 'pvp'
let isComputerThinking = false;

// Three.js 变量
let scene, camera, renderer, controls;
let raycaster, mouse;
let hoverMesh; // 鼠标悬停时的提示
let boardGroup; // 包含棋盘所有元素的组

// 初始化
init();
animate();

function init() {
    // 1. 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 天空蓝背景

    // 2. 相机
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 40);
    camera.lookAt(0, 0, 0);

    // 3. 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 4. 控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // 防止相机钻到地底下

    // 5. 灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // 6. 创建棋盘
    createBoard();

    // 7. 交互相关
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 悬停提示网格
    const hoverGeo = new THREE.SphereGeometry(PIECE_RADIUS, 32, 32);
    const hoverMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    hoverMesh.visible = false;
    scene.add(hoverMesh);

    // 事件监听
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    document.getElementById('reset-btn').addEventListener('click', resetGame);
    document.getElementById('mode-select').addEventListener('change', (e) => {
        gameMode = e.target.value;
        resetGame();
    });

    // 初始化游戏数据
    resetGameData();
}

function createBoard() {
    boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // 棋盘底座 (木纹效果用颜色模拟)
    const boardGeo = new THREE.BoxGeometry(BOARD_WIDTH + 4, 1, BOARD_WIDTH + 4);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xE6B45C, roughness: 0.5, metalness: 0.1 });
    const boardBase = new THREE.Mesh(boardGeo, boardMat);
    boardBase.position.y = -0.5;
    boardBase.receiveShadow = true;
    boardGroup.add(boardBase);

    // 画线
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true });
    const halfWidth = BOARD_WIDTH / 2;

    // 竖线
    for (let i = 0; i < BOARD_SIZE; i++) {
        const x = -halfWidth + i * CELL_SIZE;
        const points = [];
        points.push(new THREE.Vector3(x, 0.01, -halfWidth));
        points.push(new THREE.Vector3(x, 0.01, halfWidth));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        boardGroup.add(line);
    }

    // 横线
    for (let i = 0; i < BOARD_SIZE; i++) {
        const z = -halfWidth + i * CELL_SIZE;
        const points = [];
        points.push(new THREE.Vector3(-halfWidth, 0.01, z));
        points.push(new THREE.Vector3(halfWidth, 0.01, z));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        boardGroup.add(line);
    }

    // 天元和星位 (简单的黑色小圆点)
    const starPoints = [3, 7, 11];
    const starGeo = new THREE.CircleGeometry(0.2, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    starGeo.rotateX(-Math.PI / 2);

    for (let i of starPoints) {
        for (let j of starPoints) {
            const star = new THREE.Mesh(starGeo, starMat);
            star.position.set(
                -halfWidth + i * CELL_SIZE,
                0.02,
                -halfWidth + j * CELL_SIZE
            );
            boardGroup.add(star);
        }
    }
}

function resetGameData() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    currentPlayer = 1;
    isGameOver = false;
    
    // 清除棋子
    pieces.forEach(p => scene.remove(p));
    pieces = [];

    updateUI();
}

function resetGame() {
    resetGameData();
}

function updateUI() {
    const playerSpan = document.getElementById('current-player');
    const messageDiv = document.getElementById('message');
    
    playerSpan.innerText = currentPlayer === 1 ? "黑棋" : "白棋";
    playerSpan.style.color = currentPlayer === 1 ? "black" : "white";
    playerSpan.style.textShadow = currentPlayer === 2 ? "0 0 2px black" : "none"; // 白棋文字加个阴影看清楚
    
    if (!isGameOver) {
        messageDiv.innerText = "";
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function getIntersect(event) {
    // 将鼠标位置归一化为 -1 到 1
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 我们需要检测与一个不可见的平面的交点，这个平面位于 y=0
    // 创建一个临时的平面用于检测
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    
    if (target) {
        return target;
    }
    return null;
}

function worldToGrid(position) {
    const halfWidth = BOARD_WIDTH / 2;
    // 将世界坐标转换为 0 到 14 的网格坐标
    // x = -halfWidth + col * CELL_SIZE  => col = (x + halfWidth) / CELL_SIZE
    let col = Math.round((position.x + halfWidth) / CELL_SIZE);
    let row = Math.round((position.z + halfWidth) / CELL_SIZE);

    return { col, row };
}

function gridToWorld(col, row) {
    const halfWidth = BOARD_WIDTH / 2;
    return new THREE.Vector3(
        -halfWidth + col * CELL_SIZE,
        0,
        -halfWidth + row * CELL_SIZE
    );
}

function onMouseMove(event) {
    if (isGameOver) return;

    const point = getIntersect(event);
    if (point) {
        const { col, row } = worldToGrid(point);

        // 检查是否在棋盘范围内
        if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) {
            // 检查该位置是否已有棋子
            if (board[row][col] === 0) {
                const pos = gridToWorld(col, row);
                hoverMesh.position.copy(pos);
                hoverMesh.visible = true;
                // 根据当前玩家改变提示颜色
                hoverMesh.material.color.setHex(currentPlayer === 1 ? 0x000000 : 0xffffff);
                return;
            }
        }
    }
    hoverMesh.visible = false;
}

function onMouseClick(event) {
    if (isGameOver || isComputerThinking) return;

    // 忽略点击UI的情况，虽然CSS pointer-events处理了一部分，但这里最好也防一下
    if (event.target.closest('#info')) return;

    const point = getIntersect(event);
    if (point) {
        const { col, row } = worldToGrid(point);

        if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) {
            if (board[row][col] === 0) {
                placePiece(col, row);
            }
        }
    }
}

function placePiece(col, row) {
    // 逻辑落子
    board[row][col] = currentPlayer;

    // 视觉落子
    const geometry = new THREE.SphereGeometry(PIECE_RADIUS, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: currentPlayer === 1 ? 0x111111 : 0xffffff,
        roughness: 0.1,
        metalness: 0.2
    });
    const piece = new THREE.Mesh(geometry, material);
    
    const pos = gridToWorld(col, row);
    piece.position.set(pos.x, PIECE_RADIUS, pos.z);
    piece.castShadow = true;
    piece.receiveShadow = true;
    
    scene.add(piece);
    pieces.push(piece);

    // 检查胜负
    if (checkWin(col, row)) {
        isGameOver = true;
        const winner = currentPlayer === 1 ? "黑棋" : "白棋";
        document.getElementById('message').innerText = `${winner} 获胜！`;
        // alert(`${winner} 获胜！`);
    } else {
        // 切换玩家
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updateUI();

        // 如果是人机模式，且轮到白棋（AI），则触发AI落子
        if (gameMode === 'pve' && currentPlayer === 2 && !isGameOver) {
            isComputerThinking = true;
            setTimeout(computerMove, 500); // 延迟一下，让体验更自然
        }
    }
}

function checkWin(col, row) {
    const color = board[row][col];
    const directions = [
        [1, 0],  // 横向
        [0, 1],  // 纵向
        [1, 1],  // 斜向 \
        [1, -1]  // 反斜 /
    ];

    for (let [dx, dy] of directions) {
        let count = 1;
        
        // 正向查找
        let i = 1;
        while (true) {
            const c = col + dx * i;
            const r = row + dy * i;
            if (c < 0 || c >= BOARD_SIZE || r < 0 || r >= BOARD_SIZE || board[r][c] !== color) break;
            count++;
            i++;
        }

        // 反向查找
        i = 1;
        while (true) {
            const c = col - dx * i;
            const r = row - dy * i;
            if (c < 0 || c >= BOARD_SIZE || r < 0 || r >= BOARD_SIZE || board[r][c] !== color) break;
            count++;
            i++;
        }

        if (count >= 5) return true;
    }
    return false;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// AI 逻辑
function computerMove() {
    if (isGameOver) return;

    let bestScore = -Infinity;
    let bestMoves = [];

    // 遍历所有空位
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) {
                // 评估该位置的分数
                // AI是白棋(2)，玩家是黑棋(1)
                // 进攻分：如果白棋下这
                const attackScore = evaluatePoint(r, c, 2);
                // 防守分：如果黑棋下这
                const defenseScore = evaluatePoint(r, c, 1);

                // 总分 = 进攻分 + 防守分
                let score = attackScore + defenseScore;
                
                // 特殊情况处理，提高优先级
                if (attackScore >= 100000) score = 200000; // 能赢必须赢
                else if (defenseScore >= 100000) score = 150000; // 对方要赢必须堵

                if (score > bestScore) {
                    bestScore = score;
                    bestMoves = [{r, c}];
                } else if (score === bestScore) {
                    bestMoves.push({r, c});
                }
            }
        }
    }

    // 如果没有最佳移动（比如开局），下天元或者随机
    if (bestMoves.length === 0) {
        const center = Math.floor(BOARD_SIZE / 2);
        if (board[center][center] === 0) {
            placePiece(center, center);
        } else {
            // 随便找个空位
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c] === 0) {
                        placePiece(c, r);
                        isComputerThinking = false;
                        return;
                    }
                }
            }
        }
    } else {
        // 随机选择一个最高分的点
        const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        placePiece(move.c, move.r);
    }
    
    isComputerThinking = false;
}

function evaluatePoint(row, col, player) {
    let score = 0;
    // 四个方向：横、竖、左斜、右斜
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (let [dx, dy] of directions) {
        // 统计该方向上连续的棋子数和两端的空位数
        let count = 1; // 当前点算一个
        let blocked = 0;

        // 正向
        let i = 1;
        while (true) {
            const r = row + dy * i;
            const c = col + dx * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
                blocked++;
                break;
            }
            if (board[r][c] === player) {
                count++;
            } else if (board[r][c] === 0) {
                break;
            } else {
                blocked++;
                break;
            }
            i++;
        }

        // 反向
        i = 1;
        while (true) {
            const r = row - dy * i;
            const c = col - dx * i;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
                blocked++;
                break;
            }
            if (board[r][c] === player) {
                count++;
            } else if (board[r][c] === 0) {
                break;
            } else {
                blocked++;
                break;
            }
            i++;
        }

        // 根据 count 和 blocked 评分
        if (blocked === 2) {
            if (count >= 5) score += 100000; // 即使被堵也是5连
            else score += 0; // 两头堵死没意义
        } else if (blocked === 1) {
            if (count >= 5) score += 100000;
            else if (count === 4) score += 10000; // 冲四
            else if (count === 3) score += 1000;  // 冲三
            else if (count === 2) score += 100;
        } else { // blocked === 0
            if (count >= 5) score += 100000;
            else if (count === 4) score += 50000; // 活四
            else if (count === 3) score += 10000; // 活三
            else if (count === 2) score += 500;   // 活二
            else if (count === 1) score += 10;
        }
    }
    
    // 额外加分：靠近中心
    const center = BOARD_SIZE / 2;
    const dist = Math.abs(row - center) + Math.abs(col - center);
    score += (BOARD_SIZE - dist);

    return score;
}
