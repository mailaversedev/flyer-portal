const DEFAULT_SPREADING_COEFFICIENT = 0.845;
const DEFAULT_MAILCOIN_HKD_RATE = 0.02;
const DEFAULT_LOTTERY_FACTOR = 20;
const DEFAULT_EVENT_COST_PERCENT = 0.6;
const DEFAULT_EVENT_USAGE_PERCENT = 0.8;

function getSpreadingCoefficient() {
  const rawValue = process.env.SPREADING_COEFFICIENT;
  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SPREADING_COEFFICIENT;
  }

  return parsed;
}

function getMailcoinHkdRate() {
  const rawValue = process.env.MAILCOIN_HKD_RATE;
  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAILCOIN_HKD_RATE;
  }

  return parsed;
}

function hkdToMailcoin(amountHkd) {
  const numeric = Number(amountHkd) || 0;
  const rate = getMailcoinHkdRate();
  return Math.max(0, Math.floor(numeric / rate));
}

function calculateLotteryMetricsFromHkd(poolHkd) {
  const spreadingCoefficient = getSpreadingCoefficient();
  const mailcoinHkdRate = getMailcoinHkdRate();
  const pool = hkdToMailcoin(poolHkd);

  const userReached = Math.max(0, Math.floor(poolHkd / spreadingCoefficient));
  const finalPool = Math.max(0, Math.floor(pool / spreadingCoefficient));
  const maxUsers = Math.max(
    1,
    Math.floor(userReached / DEFAULT_LOTTERY_FACTOR)
  );
  const eventMoney = Math.max(
    0,
    Math.floor(pool * (1 - DEFAULT_EVENT_COST_PERCENT))
  );
  const lotteryMoney = Math.max(
    0,
    Math.floor(eventMoney * DEFAULT_EVENT_USAGE_PERCENT)
  );
  const avgMoneyPerUser = Math.max(0, Math.floor(lotteryMoney / maxUsers));

  return {
    pool,
    spreadingCoefficient,
    mailcoinHkdRate,
    lotteryFactor: DEFAULT_LOTTERY_FACTOR,
    eventCostPercent: DEFAULT_EVENT_COST_PERCENT,
    eventUsagePercent: DEFAULT_EVENT_USAGE_PERCENT,
    userReached,
    finalPool,
    maxUsers,
    eventMoney,
    lotteryMoney,
    avgMoneyPerUser,
  };
}

module.exports = {
  getSpreadingCoefficient,
  getMailcoinHkdRate,
  hkdToMailcoin,
  calculateLotteryMetricsFromHkd,
};
