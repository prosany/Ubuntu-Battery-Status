require('dotenv').config();
const { execSync } = require('child_process');
const axios = require('axios');
const IORedis = require('ioredis');

const DISCORD_WEBHOOK_URL = process.env.WEBHOOK_URL; // Replace with your webhook
const REDIS_KEY_FULL = 'battery:last_full_notification';
const REDIS_KEY_LOW = 'battery:last_low_notification';
const THROTTLE_MINUTES = 30;

// Create Redis client
const redisClient = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: () => 5000,
});

// Helper to read battery info
const getBatteryInfo = async () => {
  try {
    const output = execSync('upower -i $(upower -e | grep battery)', {
      encoding: 'utf-8',
    });
    const percentageMatch = output.match(/percentage:\s+(\d+)%/);
    const stateMatch = output.match(/state:\s+(\w+)/);

    if (percentageMatch && stateMatch) {
      return {
        percentage: parseInt(percentageMatch[1], 10),
        state: stateMatch[1],
      };
    }
  } catch (err) {
    console.error('Failed to read battery info:', err.message);
  }
  return null;
};

// Send Discord webhook
const sendDiscordMessage = async (content) => {
  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content });
    console.log('✅ Sent to Discord:', content);
  } catch (err) {
    console.error('Discord error:', err.message);
  }
};

// Time diff in minutes
const minutesSince = (timestamp) =>
  (Date.now() - parseInt(timestamp || '0', 10)) / (1000 * 60);

// Monitor loop
const monitorBattery = async () => {
  const info = await getBatteryInfo();
  if (!info) return;

  const { percentage, state } = info;
  const now = Date.now();

  if (percentage >= 100 && state === 'charging') {
    const lastSent = await redisClient.get(REDIS_KEY_FULL);
    if (!lastSent || minutesSince(lastSent) >= THROTTLE_MINUTES) {
      await sendDiscordMessage(
        '🔋 Battery fully charged (100%). You can unplug the charger.'
      );
      await redisClient.set(REDIS_KEY_FULL, now.toString());
    }
  }

  if (percentage <= 20 && state === 'discharging') {
    const lastSent = await redisClient.get(REDIS_KEY_LOW);
    if (!lastSent || minutesSince(lastSent) >= THROTTLE_MINUTES) {
      await sendDiscordMessage(
        '⚠️ Battery is low (20% or less). Please connect your charger.'
      );
      await redisClient.set(REDIS_KEY_LOW, now.toString());
    }
  }

  console.log(`Battery: ${percentage}% (${state})`);
};

// Run every 1 minute
monitorBattery(); // run once immediately
setInterval(monitorBattery, 60 * 1000);
