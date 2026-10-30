/** Valores del juego. Están juntos para ajustarlos fácilmente. */

/** Patos por persona. Para adoptar otro hay que liberar uno. */
export const MAX_DUCKS = 3;

/** PatoCoins que recibe el jugador al llegar a un nivel: nivel × 10 (nivel 2 → 20, nivel 10 → 100). */
export const LEVEL_UP_COINS_PER_LEVEL = 10;
export const levelUpReward = (level: number) => level * LEVEL_UP_COINS_PER_LEVEL;

/**
 * Economía (por día, un jugador normal): check-in 25 + ~2 carreras (~40) + subidas de nivel (~10–30) ≈ 80–100 🪙.
 * Un cosmético cuesta así un día y medio o dos de juego; los 35, unos dos meses. Entrenar un pato al máximo, más.
 */
/** Precio con el que entra cada cosmético en la tienda. El staff puede cambiarlo con /cosmeticos precio. */
export const COSMETIC_PRICE = 150;
/** PatoCoins del check-in diario (/diario), una vez por día en la zona horaria del servidor. */
export const DAILY_COINS = 25;
/** Parte de lo invertido en entrenar un pato que se devuelve al liberarlo. */
export const RELEASE_REFUND = 0.5;
/** Probabilidad de que, al adoptar al azar (cada vez que se pulsa Otro), salga un pato sin dueño si hay alguno. */
export const STRAY_ADOPT_CHANCE = 0.25;

/** Nivel máximo de un pato. Los patos suben de nivel entrenándolos con PatoCoins. */
export const MAX_DUCK_LEVEL = 20;
/** Coste de entrenar un pato de nivel L al L+1: 50 × L (de 1 a 2: 50; de 19 a 20: 950; de 1 a 20: 9 500). */
export const DUCK_TRAIN_COST_PER_LEVEL = 50;
export const trainCost = (level: number) => level * DUCK_TRAIN_COST_PER_LEVEL;
/** Total invertido en entrenar un pato hasta `level` (desde el nivel 1). */
export const trainedCoins = (level: number) => DUCK_TRAIN_COST_PER_LEVEL * ((level * (level - 1)) / 2);
/** Lo que se devuelve al liberar un pato de ese nivel (la mitad de lo invertido, redondeado hacia abajo). */
export const releaseRefund = (level: number) => Math.floor(trainedCoins(level) * RELEASE_REFUND);

/** XP por mensaje (antes del multiplicador de eventos). */
export const XP_PER_MESSAGE = 10;
/** Solo un mensaje por persona da XP en este intervalo: evita que el spam suba de nivel. */
export const XP_COOLDOWN_MS = 60_000;
/** Multiplicadores que se pueden elegir para un evento de XP. */
export const XP_EVENT_MULTIPLIERS = [1.5, 2, 3] as const;
/** Duración máxima de un evento, en horas. */
export const XP_EVENT_MAX_HOURS = 168;

/** Carreras por servidor y día (en la zona horaria del servidor). Las canceladas no cuentan. */
export const RACES_PER_DAY = 10;
/** Patos por carrera: los carriles que no ocupan jugadores los llenan patos del bot. */
export const RACE_MAX_DUCKS = 8;
/** Tiempo para apuntarse antes de que salga la carrera. */
export const RACE_LOBBY_MS = 60_000;
/** PatoCoins por puesto (1.º, 2.º, 3.º); el resto recibe RACE_PARTICIPATION_PRIZE. Los patos del bot no cobran. */
export const RACE_PRIZES = [50, 30, 20] as const;
export const RACE_PARTICIPATION_PRIZE = 10;
/** Cada jugador además del primero sube los premios un 25 %: con 8 jugadores valen ×2.75. */
export const RACE_PRIZE_BONUS_PER_PLAYER = 0.25;

/** Premio de un puesto (1 = primero) en una carrera con `players` jugadores (sin contar los patos del bot). */
export const racePrize = (position: number, players = 1) =>
  Math.round(
    (RACE_PRIZES[position - 1] ?? RACE_PARTICIPATION_PRIZE) *
      (1 + RACE_PRIZE_BONUS_PER_PLAYER * (Math.max(1, players) - 1)),
  );

/** Precio máximo que un admin puede poner a un cosmético. */
export const MAX_PRICE = 1_000_000;

export const DEFAULT_TIMEZONE = 'America/Mexico_City';
