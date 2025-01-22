import {Database} from "bun:sqlite"
import {randomUUID} from "crypto";

const db = new Database("casino.db")

// Tables initialization
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE,
    balance INTEGER DEFAULT 100,
    nickname TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game TEXT NOT NULL,
    gamesPlayed INTEGER DEFAULT 0,
    gamesWon INTEGER DEFAULT 0,
    gamesLost INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS global_stats (
    user_id INTEGER PRIMARY KEY,
    globalGamesPlayed INTEGER DEFAULT 0,
    globalGamesWon INTEGER DEFAULT 0,
    globalGamesLost INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS balance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    change INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// User creation and checks
export function createUser() {
    const token = randomUUID();
    db.run(
        "INSERT INTO users (token, balance) VALUES (?, ?)",
        [token, 100]
    )
    const user = db.query("SELECT id FROM users WHERE token = ?").get(token);
    console.log(user);
    db.query("INSERT INTO global_stats (user_id) VALUES (?)").run(user.id);
    db.query("INSERT INTO game_stats (user_id, game) VALUES (?, ?)")
      .run(user.id, "coinflip");
    return token
}

export function tokenExists(token) {
    const result = db.query("SELECT token FROM users WHERE token = ?").get(token);
    return !!result;
  }


// Balance management
export function getBalance(userToken) {
    const result = db.query("SELECT balance FROM users WHERE token = ?").get(userToken);
    return result ? result.balance : null;
}

export function getGlobalStats(token) {
    return db.query(`
      SELECT globalGamesPlayed, globalGamesWon, globalGamesLost
      FROM global_stats
      WHERE user_id = (SELECT id FROM users WHERE token = ?)
    `).get(token);
}

export function getGameStats(token, game) {
    return db.query(`
    SELECT gamesPlayed, gamesWon, gamesLost
    FROM game_stats
    WHERE user_id = (SELECT id FROM users WHERE token = ?) AND game = ?
  `).get(token, game);
}

export function updateStats(token, game, won) {
  db.query(`
    UPDATE game_stats
    SET gamesPlayed = gamesPlayed + 1,
        gamesWon = gamesWon + ?,
        gamesLost = gamesLost + ?
    WHERE user_id = (SELECT id FROM users WHERE token = ?) AND game = ?
  `).run(won ? 1 : 0, won ? 0 : 1, token, game);

  db.query(`
    UPDATE global_stats
    SET globalGamesPlayed = globalGamesPlayed + 1,
        globalGamesWon = globalGamesWon + ?,
        globalGamesLost = globalGamesLost + ?
    WHERE user_id = (SELECT id FROM users WHERE token = ?)
  `).run(won ? 1 : 0, won ? 0 : 1, token);
}

export function updateBalanceWithHistory(token, amount) {
  const user = db.query("SELECT id, balance FROM users WHERE token = ?").get(token);
  db.query("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, user.id);
  db.query("INSERT INTO balance_history (user_id, change) VALUES (?, ?)").run(user.id, amount);

  return true;
}


export function getBalanceHistory(token) {
  return db.query(`
    SELECT change, timestamp
    FROM balance_history
    WHERE user_id = (SELECT id FROM users WHERE token = ?)
  `).all(token);
}

export function getAllTimeBalanceRankings() {
  const users = db.query("SELECT nickname, balance, token FROM users ORDER BY balance DESC").all();
  return users.map(user => ({
    nickname: user.nickname,
    balance: user.balance,
    token: user.token.slice(-4),
  }));
}

export function getAllTimePlayedRankings(gameResult) {
  const possibleParameters = ["played", "wins", "losses"];
  const sortFactors = ["g.globalGamesPlayed", "g.globalGamesWon", "g.globalGamesLost"];
  if (!possibleParameters.includes(gameResult)) gameResult = "played";

  const f = sortFactors[possibleParameters.indexOf(gameResult)];
  const users = db.query(`
    SELECT u.nickname, u.balance, u.token, g.globalGamesPlayed, g.globalGamesWon, g.globalGamesLost
    FROM users u
    JOIN global_stats g ON u.id = g.user_id
    ORDER BY ? DESC
  `).all(f);
  return users.map(user => ({
    nickname: user.nickname,
    gamesPlayed: user.globalGamesPlayed,
    gamesWon: user.globalGamesWon,
    gamesLost: user.globalGamesLost,
    token: user.token.slice(-4),
  }))
}